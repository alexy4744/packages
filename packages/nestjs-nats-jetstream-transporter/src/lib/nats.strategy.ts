import { CustomTransportStrategy, MessageHandler, Server } from "@nestjs/microservices";
import { Logger } from "@nestjs/common";

import {
  Codec,
  ConnectionOptions,
  JetStreamClient,
  JetStreamManager,
  JsMsg,
  JSONCodec,
  Msg,
  NatsConnection,
  StreamInfo,
  connect,
  consumerOpts,
  createInbox
} from "nats";

import { ConsumerOptsBuilderImpl } from "nats/lib/nats-base-client/jsconsumeropts";

import { noop } from "rxjs";

import { NatsTransportStrategyOptions } from "./interfaces/nats-transport-strategy-options.interface";

import { NatsStreamConfig } from "./interfaces/nats-stream-config.interface";

import { NatsContext } from "./nats.context";

import { NACK, TERM } from "./nats.constants";

export class NatsTransportStrategy extends Server implements CustomTransportStrategy {
  protected readonly codec: Codec<unknown>;
  protected readonly logger: Logger;

  protected connection?: NatsConnection;
  protected jetstreamClient?: JetStreamClient;
  protected jetstreamManager?: JetStreamManager;

  constructor(protected readonly options: NatsTransportStrategyOptions = {}) {
    super();
    this.codec = options.codec || JSONCodec();
    this.logger = new Logger("NatsServer");
  }

  async listen(callback: typeof noop): Promise<void> {
    this.connection = await this.createNatsConnection(this.options.connection);
    this.jetstreamClient = this.createJetStreamClient(this.connection);
    this.jetstreamManager = await this.createJetStreamManager(this.connection);

    this.handleStatusUpdates(this.connection);

    await this.createStreams(this.jetstreamManager, this.options.streams);

    await this.subscribeToEventPatterns(this.jetstreamClient);

    this.subscribeToMessagePatterns(this.connection);

    this.logger.log(`Connected to ${this.connection.getServer()}`);

    callback();
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.drain();

      this.connection = undefined;
      this.jetstreamClient = undefined;
      this.jetstreamManager = undefined;
    }
  }

  /**
   * Create a durable name that follows NATS naming rules
   * @see https://docs.nats.io/jetstream/administration/naming
   */
  createDurableName(...parts: string[]): string {
    return parts.join("-").replace(/\s|\.|>|\*/g, "-");
  }

  createJetStreamClient(connection: NatsConnection): JetStreamClient {
    return connection.jetstream();
  }

  createJetStreamManager(connection: NatsConnection): Promise<JetStreamManager> {
    return connection.jetstreamManager();
  }

  createNatsConnection(options: ConnectionOptions = {}): Promise<NatsConnection> {
    return connect(options);
  }

  async createStreams(manager: JetStreamManager, configs: NatsStreamConfig[] = []): Promise<void> {
    await Promise.all(configs.map((config) => this.upsertStream(manager, config)));
  }

  async handleJetStreamMessage(message: JsMsg, handler: MessageHandler): Promise<void> {
    const handleError = this.options.onError || ((message) => message.term());

    try {
      const decoded = this.codec.decode(message.data);

      message.working();

      const signal = await handler(decoded, new NatsContext([message]))
        .then((maybeObservable) => this.transformToObservable(maybeObservable))
        .then((observable) => observable.toPromise());

      if (signal === NACK) {
        return message.nak();
      }

      if (signal === TERM) {
        return message.term();
      }

      message.ack();
    } catch {
      handleError(message);
    }
  }

  async handleNatsMessage(message: Msg, handler: MessageHandler): Promise<void> {
    const decoded = this.codec.decode(message.data);

    const maybeObservable = await handler(decoded, new NatsContext([message]));
    const response$ = this.transformToObservable(maybeObservable);

    this.send(response$, (response) => {
      const encoded = this.codec.encode(response);

      message.respond(encoded);
    });
  }

  async handleStatusUpdates(connection: NatsConnection): Promise<void> {
    for await (const status of connection.status()) {
      const data = typeof status.data === "object" ? JSON.stringify(status.data) : status.data;
      const message = `(${status.type}): ${data}`;

      switch (status.type) {
        case "pingTimer":
        case "reconnecting":
        case "staleConnection":
          this.logger.debug(message);
          break;

        case "disconnect":
        case "error":
          this.logger.error(message);
          break;

        case "reconnect":
          this.logger.log(message);
          break;

        case "ldm":
          this.logger.warn(message);
          break;

        case "update":
          this.logger.verbose(message);
          break;
      }
    }
  }

  async subscribeToEventPatterns(client: JetStreamClient): Promise<void> {
    const eventHandlers = [...this.messageHandlers.entries()].filter(
      ([, handler]) => handler.isEventHandler
    );

    for (const [pattern, handler] of eventHandlers) {
      // Need to access config options that is not exposed by the ConsumerOptsBuilder interface
      // https://github.com/nats-io/nats.deno/blob/main/nats-base-client/jsconsumeropts.ts#L55
      const consumerOptions = consumerOpts() as ConsumerOptsBuilderImpl;

      if (this.options.consumer) {
        this.options.consumer(consumerOptions);
      }

      if (consumerOptions.config.durable_name) {
        consumerOptions.durable(
          this.createDurableName(consumerOptions.config.durable_name, pattern)
        );
      }

      consumerOptions.callback((error, message) => {
        if (error) {
          return this.logger.error(error.message, error.stack);
        }

        if (message) {
          return this.handleJetStreamMessage(message, handler);
        }
      });

      consumerOptions.deliverTo(createInbox());

      consumerOptions.manualAck();

      try {
        await client.subscribe(pattern, consumerOptions);

        this.logger.log(`Subscribed to ${pattern} events`);
      } catch (error) {
        if (error.message === "no stream matches subject") {
          throw new Error(`Cannot find stream with the ${pattern} event pattern`);
        }

        throw error;
      }
    }
  }

  subscribeToMessagePatterns(connection: NatsConnection): void {
    const messageHandlers = [...this.messageHandlers.entries()].filter(
      ([, handler]) => !handler.isEventHandler
    );

    for (const [pattern, handler] of messageHandlers) {
      connection.subscribe(pattern, {
        callback: (error, message) => {
          if (error) {
            return this.logger.error(error.message, error.stack);
          }

          return this.handleNatsMessage(message, handler);
        },
        queue: this.options.queue
      });

      this.logger.log(`Subscribed to ${pattern} messages`);
    }
  }

  /**
   * Creates a new stream if it doesn't exist, otherwise updates the existing stream
   */
  async upsertStream(manager: JetStreamManager, config: NatsStreamConfig): Promise<StreamInfo> {
    try {
      const stream = await manager.streams.info(config.name);

      const updated = await manager.streams.update({
        ...stream.config,
        ...config
      });

      return updated;
    } catch (error) {
      if (error.message === "stream not found") {
        const added = await manager.streams.add(config);

        return added;
      }

      throw error;
    }
  }
}
