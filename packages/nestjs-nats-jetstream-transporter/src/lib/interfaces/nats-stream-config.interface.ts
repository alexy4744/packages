import { StreamConfig } from "nats";

export type NatsStreamConfig = Partial<StreamConfig> & Pick<StreamConfig, "name">;
