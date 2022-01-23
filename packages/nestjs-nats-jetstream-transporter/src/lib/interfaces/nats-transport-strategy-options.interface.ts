import { Codec, ConnectionOptions, ConsumerOptsBuilder } from "nats";

import { NatsStreamConfig } from "./nats-stream-config.interface";

export interface NatsTransportStrategyOptions {
  /**
   * NATS codec to use for encoding and decoding messages
   */
  codec?: Codec<unknown>;

  /**
   * NATS connection options
   */
  connection?: ConnectionOptions;

  /**
   * Consumer options for JetStream subscriptions
   * @see https://github.com/nats-io/nats.deno/blob/main/jetstream.md#push-subscriptions
   * @see https://docs.nats.io/jetstream/concepts/consumers
   */
  consumer?: (options: ConsumerOptsBuilder) => void;

  /**
   * Queue group name
   * @see https://docs.nats.io/nats-concepts/queue
   */
  queue?: string;

  /**
   * @see https://github.com/nats-io/nats.deno/blob/main/jetstream.md#jetstreammanager
   * @see https://docs.nats.io/jetstream/concepts/streams
   */
  streams?: NatsStreamConfig[];
}
