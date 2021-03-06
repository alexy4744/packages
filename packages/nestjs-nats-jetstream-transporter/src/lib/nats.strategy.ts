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
  connect,
  consumerOpts,
  createInbox,
  NatsError
} from "nats";

import { NatsTransportStrategyOptions } from "./interfaces/nats-transport-strategy-options.interface";

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
    this.logger = new Logger(NatsTransportStrategy.name);
  }

  async listen(callback: () => void): Promise<void> {
    this.connection = await this.createNatsConnection(this.options.connection);
    this.jetstreamClient = this.createJetStreamClient(this.connection);
    this.jetstreamManager = await this.createJetStreamManager(this.connection);

    this.handleStatusUpdates(this.connection);

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

  createJetStreamClient(connection: NatsConnection): JetStreamClient {
    return connection.jetstream();
  }

  createJetStreamManager(connection: NatsConnection): Promise<JetStreamManager> {
    return connection.jetstreamManager();
  }

  createNatsConnection(options: ConnectionOptions = {}): Promise<NatsConnection> {
    return connect(options);
  }

  async handleJetStreamMessage(message: JsMsg, handler: MessageHandler): Promise<void> {
    const decoded = this.codec.decode(message.data);

    message.working();

    try {
      await handler(decoded, new NatsContext([message]))
        .then((maybeObservable) => this.transformToObservable(maybeObservable))
        .then((observable) => observable.toPromise());

      message.ack();
    } catch (error) {
      if (error === NACK) {
        return message.nak();
      }

      if (error === TERM) {
        return message.term();
      }

      throw error;
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
      const consumerOptions = consumerOpts();

      if (this.options.consumer) {
        this.options.consumer(consumerOptions);
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
        if (!(error instanceof NatsError) || !error.isJetStreamError()) {
          throw error;
        }

        if (error.message === "no stream matches subject") {
          throw new Error(`Cannot find stream with the ${pattern} event pattern`);
        }
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
}
