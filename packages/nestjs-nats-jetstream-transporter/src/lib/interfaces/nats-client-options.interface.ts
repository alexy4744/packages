import { Codec, ConnectionOptions } from "nats";

export interface NatsClientOptions {
  /**
   * NATS codec to use for encoding and decoding messages
   */
  codec?: Codec<unknown>;

  /**
   * NATS connection options
   */
  connection?: ConnectionOptions;
}
