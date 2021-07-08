import { ClientProxy, ReadPacket, WritePacket } from "@nestjs/microservices";
import { Logger } from "@nestjs/common";

import {
  Codec,
  JetStreamClient,
  JSONCodec,
  NatsConnection,
  connect,
  ConnectionOptions
} from "nats";

import { noop } from "rxjs";

import { NatsClientOptions } from "./interfaces/nats-client-options.interface";

export class NatsClient extends ClientProxy {
  protected readonly codec: Codec<unknown>;
  protected readonly logger: Logger;

  protected connection?: NatsConnection;
  protected jetstreamClient?: JetStreamClient;

  constructor(protected readonly options: NatsClientOptions = {}) {
    super();
    this.codec = options.codec || JSONCodec();
    this.logger = new Logger(this.constructor.name);
  }

  async connect(): Promise<NatsConnection> {
    if (this.connection) {
      return this.connection;
    }

    this.connection = await this.createNatsConnection(this.options.connection);
    this.jetstreamClient = this.createJetStreamClient(this.connection);

    this.handleStatusUpdates(this.connection);

    this.logger.log(`Connected to ${this.connection.getServer()}`);

    return this.connection;
  }

  async close(): Promise<void> {
    if (this.connection) {
      await this.connection.drain();

      this.connection = undefined;
      this.jetstreamClient = undefined;
    }
  }

  createJetStreamClient(connection: NatsConnection): JetStreamClient {
    return connection.jetstream();
  }

  createNatsConnection(options: ConnectionOptions = {}): Promise<NatsConnection> {
    return connect(options);
  }

  getConnection(): NatsConnection | undefined {
    return this.connection;
  }

  getJetStreamClient(): JetStreamClient | undefined {
    return this.jetstreamClient;
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  protected async dispatchEvent(packet: ReadPacket): Promise<any> {
    if (!this.jetstreamClient) {
      throw new Error("JetStream not connected!");
    }

    const payload = this.codec.encode(packet.data);
    const subject = this.normalizePattern(packet.pattern);

    await this.jetstreamClient.publish(subject, payload);
  }

  protected publish(packet: ReadPacket, callback: (packet: WritePacket) => void): typeof noop {
    if (!this.connection) {
      throw new Error("NATS not connected!");
    }

    const payload = this.codec.encode(packet.data);
    const subject = this.normalizePattern(packet.pattern);

    this.connection
      .request(subject, payload)
      .then((encoded) => this.codec.decode(encoded.data) as WritePacket)
      .then((packet) => callback(packet))
      .catch((err) => callback({ err }));

    // No teardown function needed as the subscription is handled for us, so return noop
    return noop;
  }
}
