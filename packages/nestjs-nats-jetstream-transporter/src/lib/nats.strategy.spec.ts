import {
  ConsumerOptsBuilder,
  JetStreamClient,
  JetStreamManager,
  JsMsg,
  JSONCodec,
  Msg,
  NatsConnection,
  StreamAPI,
  StringCodec
} from "nats";

import { NatsContext } from "./nats.context";

import { NatsTransportStrategy } from "./nats.strategy";

import { NACK, TERM } from "./nats.constants";

import { NatsStreamConfig } from "./interfaces/nats-stream-config.interface";

import { createMock } from "@golevelup/ts-jest";

describe("NatsTransportStrategy", () => {
  let strategy: NatsTransportStrategy;

  beforeEach(() => {
    strategy = new NatsTransportStrategy();
  });

  describe("listen", () => {
    it("bootstraps correctly", (complete) => {
      const jetstreamClient = createMock<JetStreamClient>();
      const jetstreamManager = createMock<JetStreamManager>();

      const connection = createMock<NatsConnection>({
        getServer: () => "nats://test:4222",
        jetstream: () => jetstreamClient,
        jetstreamManager: () => Promise.resolve(jetstreamManager)
      });

      const createStreamsSpy = jest.spyOn(strategy, "createStreams");

      const handleStatusUpdatesSpy = jest.spyOn(strategy, "handleStatusUpdates");

      const subscribeToEventPatternsSpy = jest.spyOn(strategy, "subscribeToEventPatterns");
      const subscribeToMessagePatternsSpy = jest.spyOn(strategy, "subscribeToMessagePatterns");

      const loggerSpy = jest.spyOn(strategy["logger"], "log");

      jest.spyOn(strategy, "createNatsConnection").mockResolvedValue(connection);

      strategy.listen(() => {
        expect(strategy["connection"]).toStrictEqual(connection);
        expect(strategy["jetstreamClient"]).toStrictEqual(jetstreamClient);
        expect(strategy["jetstreamManager"]).toStrictEqual(jetstreamManager);

        expect(createStreamsSpy).toBeCalledTimes(1);
        expect(createStreamsSpy).toBeCalledWith(strategy["jetstreamManager"], undefined);

        expect(handleStatusUpdatesSpy).toBeCalledTimes(1);
        expect(handleStatusUpdatesSpy).toBeCalledWith(strategy["connection"]);

        expect(subscribeToEventPatternsSpy).toBeCalledTimes(1);
        expect(subscribeToEventPatternsSpy).toBeCalledWith(strategy["jetstreamClient"]);

        expect(subscribeToMessagePatternsSpy).toBeCalledTimes(1);
        expect(subscribeToMessagePatternsSpy).toBeCalledWith(strategy["connection"]);

        expect(loggerSpy).toBeCalledTimes(1);
        expect(loggerSpy).toBeCalledWith("Connected to nats://test:4222");

        complete();
      });
    });
  });

  describe("close", () => {
    it("should drain and cleanup", async () => {
      const connection = createMock<NatsConnection>({
        drain: jest.fn()
      });

      strategy["connection"] = connection;
      strategy["jetstreamClient"] = createMock<JetStreamClient>();
      strategy["jetstreamManager"] = createMock<JetStreamManager>();

      await strategy.close();

      expect(connection.drain).toBeCalledTimes(1);

      expect(strategy["connection"]).toBeUndefined();
      expect(strategy["jetstreamClient"]).toBeUndefined();
      expect(strategy["jetstreamManager"]).toBeUndefined();
    });
  });

  describe("createDurableName", () => {
    it("creates a compliant durable name", () => {
      expect(strategy.createDurableName("this > ", "is", "a", "*test*")).toEqual(
        "this----is-a--test-"
      );
    });
  });

  describe("createJetStreamClient", () => {
    it("returns a jetstream client", () => {
      const jsMock = createMock<JetStreamClient>();

      const connection = createMock<NatsConnection>({
        jetstream: () => jsMock
      });

      const jetStreamClient = strategy.createJetStreamClient(connection);

      expect(connection.jetstream).toBeCalledTimes(1);
      expect(jetStreamClient).toStrictEqual(jsMock);
    });
  });

  describe("createJetStreamManager", () => {
    it("returns a jetstream manager", async () => {
      const jsmMock = createMock<JetStreamManager>();

      const client = createMock<NatsConnection>({
        jetstreamManager: () => Promise.resolve(jsmMock)
      });

      const jetstreamManager = await strategy.createJetStreamManager(client);

      expect(client.jetstreamManager).toBeCalledTimes(1);
      expect(jetstreamManager).toStrictEqual(jsmMock);
    });
  });

  describe("createStreams", () => {
    it("upserts streams", async () => {
      const manager = createMock<JetStreamManager>({
        streams: createMock<StreamAPI>()
      });

      const streams = [createMock<NatsStreamConfig>(), createMock<NatsStreamConfig>()];

      const upsertStreamSpy = jest.spyOn(strategy, "upsertStream");

      await strategy.createStreams(manager, streams);

      expect(upsertStreamSpy).toBeCalledTimes(2);
      expect(upsertStreamSpy).toBeCalledWith(manager, streams[0]);
      expect(upsertStreamSpy).toBeCalledWith(manager, streams[1]);
    });
  });

  describe("handleJetStreamMessage", () => {
    let strategy: NatsTransportStrategy;

    beforeAll(() => {
      strategy = new NatsTransportStrategy({
        codec: StringCodec()
      });
    });

    it("should ack", async () => {
      const message = createMock<JsMsg>({
        data: new Uint8Array([104, 101, 108, 108, 111])
      });

      const handler = jest.fn().mockResolvedValue(undefined);

      await strategy.handleJetStreamMessage(message, handler);

      expect(handler).toBeCalledTimes(1);
      expect(handler).toBeCalledWith("hello", createMock<NatsContext>());

      expect(message.ack).toBeCalledTimes(1);
      expect(message.nak).not.toBeCalled();
      expect(message.term).not.toBeCalled();
      expect(message.working).toBeCalledTimes(1);
    });

    it("should nack", async () => {
      const message = createMock<JsMsg>({
        data: new Uint8Array([104, 101, 108, 108, 111])
      });

      const handler = jest.fn().mockResolvedValue(NACK);

      await strategy.handleJetStreamMessage(message, handler);

      expect(handler).toBeCalledTimes(1);
      expect(handler).toBeCalledWith("hello", createMock<NatsContext>());

      expect(message.ack).not.toBeCalled();
      expect(message.nak).toBeCalledTimes(1);
      expect(message.term).not.toBeCalled();
      expect(message.working).toBeCalledTimes(1);
    });

    it("should term", async () => {
      const message = createMock<JsMsg>({
        data: new Uint8Array([104, 101, 108, 108, 111])
      });

      const handler = jest.fn().mockResolvedValue(TERM);

      await strategy.handleJetStreamMessage(message, handler);

      expect(handler).toBeCalledTimes(1);
      expect(handler).toBeCalledWith("hello", createMock<NatsContext>());

      expect(message.ack).not.toBeCalled();
      expect(message.nak).not.toBeCalled();
      expect(message.term).toBeCalledTimes(1);
      expect(message.working).toBeCalledTimes(1);
    });

    it("should term on error by default", async () => {
      const message = createMock<JsMsg>({
        data: new Uint8Array([104, 101, 108, 108, 111])
      });

      const handler = jest.fn().mockImplementation(() => {
        throw new Error();
      });

      await strategy.handleJetStreamMessage(message, handler);

      expect(handler).toBeCalledTimes(1);
      expect(handler).toBeCalledWith("hello", createMock<NatsContext>());

      expect(message.ack).not.toBeCalled();
      expect(message.nak).not.toBeCalled();
      expect(message.term).toBeCalledTimes(1);
      expect(message.working).toBeCalledTimes(1);
    });

    it("should nack on error", async () => {
      const message = createMock<JsMsg>({
        data: new Uint8Array([104, 101, 108, 108, 111])
      });

      const handler = jest.fn().mockImplementation(() => {
        throw new Error();
      });

      strategy["options"].onError = (message) => message.nak();

      await strategy.handleJetStreamMessage(message, handler);

      expect(handler).toBeCalledTimes(1);
      expect(handler).toBeCalledWith("hello", createMock<NatsContext>());

      expect(message.ack).not.toBeCalled();
      expect(message.nak).toBeCalledTimes(1);
      expect(message.term).not.toBeCalled();
      expect(message.working).toBeCalledTimes(1);
    });
  });

  describe("handleNatsMessage", () => {
    const codec = JSONCodec();

    let strategy: NatsTransportStrategy;

    beforeAll(() => {
      strategy = new NatsTransportStrategy({
        codec
      });
    });

    it("responds to messages", async () => {
      const request = { hello: "world" };
      const response = { goodbye: "world" };

      const message = createMock<Msg>({
        data: codec.encode(request)
      });

      const handler = jest.fn().mockResolvedValue(response);

      await strategy.handleNatsMessage(message, handler);

      expect(handler).toBeCalledTimes(1);
      expect(handler).toBeCalledWith(request, createMock<NatsContext>());

      return new Promise<void>((resolve) => {
        process.nextTick(() => {
          expect(message.respond).toBeCalledTimes(1);
          expect(message.respond).toBeCalledWith(
            // fields must be in this order
            codec.encode({
              response,
              isDisposed: true
            })
          );

          resolve();
        });
      });
    });
  });

  describe("handleStatusUpdates", () => {
    it("should log debug events", async () => {
      const connection = {
        status() {
          return {
            async *[Symbol.asyncIterator]() {
              yield { type: "pingTimer", data: "1" };
              yield { type: "reconnecting", data: "1" };
              yield { type: "staleConnection", data: "1" };
            }
          };
        }
      };

      const loggerSpy = jest.spyOn(strategy["logger"], "debug");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await strategy.handleStatusUpdates(connection as any);

      expect(loggerSpy).toBeCalledTimes(3);
      expect(loggerSpy).toBeCalledWith(`(pingTimer): 1`);
      expect(loggerSpy).toBeCalledWith(`(reconnecting): 1`);
      expect(loggerSpy).toBeCalledWith(`(staleConnection): 1`);
    });

    it("should log 'error' events", async () => {
      const connection = {
        status() {
          return {
            async *[Symbol.asyncIterator]() {
              yield { type: "disconnect", data: "1" };
              yield { type: "error", data: "1" };
            }
          };
        }
      };

      const loggerSpy = jest.spyOn(strategy["logger"], "error");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await strategy.handleStatusUpdates(connection as any);

      expect(loggerSpy).toBeCalledTimes(2);
      expect(loggerSpy).toBeCalledWith(`(disconnect): 1`);
      expect(loggerSpy).toBeCalledWith(`(error): 1`);
    });

    it("should log 'reconnect' events", async () => {
      const connection = {
        status() {
          return {
            async *[Symbol.asyncIterator]() {
              yield { type: "reconnect", data: "1" };
            }
          };
        }
      };

      const loggerSpy = jest.spyOn(strategy["logger"], "log");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await strategy.handleStatusUpdates(connection as any);

      expect(loggerSpy).toBeCalledTimes(1);
      expect(loggerSpy).toBeCalledWith(`(reconnect): 1`);
    });

    it("should log 'ldm' events", async () => {
      const connection = {
        status() {
          return {
            async *[Symbol.asyncIterator]() {
              yield { type: "ldm", data: "1" };
            }
          };
        }
      };

      const loggerSpy = jest.spyOn(strategy["logger"], "warn");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await strategy.handleStatusUpdates(connection as any);

      expect(loggerSpy).toBeCalledTimes(1);
      expect(loggerSpy).toBeCalledWith(`(ldm): 1`);
    });

    it("should log 'update' events", async () => {
      const connection = {
        status() {
          return {
            async *[Symbol.asyncIterator]() {
              yield { type: "update", data: { added: ["1"], deleted: ["2"] } };
            }
          };
        }
      };

      const loggerSpy = jest.spyOn(strategy["logger"], "verbose");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await strategy.handleStatusUpdates(connection as any);

      expect(loggerSpy).toBeCalledTimes(1);
      expect(loggerSpy).toBeCalledWith(
        `(update): ${JSON.stringify({ added: ["1"], deleted: ["2"] })}`
      );
    });
  });

  describe("subscribeToEventPatterns", () => {
    it("should only subscribe to event patterns with default options", async () => {
      strategy.addHandler("my.first.event", jest.fn(), true);
      strategy.addHandler("my.second.event", jest.fn(), true);
      strategy.addHandler("my.first.message", jest.fn(), false);

      const client = createMock<JetStreamClient>();

      await strategy.subscribeToEventPatterns(client);

      const defaultConsumerOptions = expect.objectContaining({
        config: expect.objectContaining({
          deliver_subject: expect.stringMatching(/^_INBOX\./)
        }),
        mack: true
      });

      expect(client.subscribe).toBeCalledTimes(2);
      expect(client.subscribe).toBeCalledWith("my.first.event", defaultConsumerOptions);
      expect(client.subscribe).toBeCalledWith("my.second.event", defaultConsumerOptions);
      expect(client.subscribe).not.toBeCalledWith("my.first.message");
    });

    it("should prefix the event pattern with a durable name if provided", async () => {
      strategy.addHandler("my.event", jest.fn(), true);

      strategy["options"].consumer = (options: ConsumerOptsBuilder) => {
        options.durable("durable");
      };

      const client = createMock<JetStreamClient>();

      await strategy.subscribeToEventPatterns(client);

      const consumerOptions = expect.objectContaining({
        config: expect.objectContaining({
          deliver_subject: expect.stringMatching(/^_INBOX\./),
          durable_name: "durable-my-event"
        }),
        mack: true
      });

      expect(client.subscribe).toBeCalledTimes(1);
      expect(client.subscribe).toBeCalledWith("my.event", consumerOptions);
    });
  });

  describe("subscribeToMessagePatterns", () => {
    it("should only subscribe to message patterns with default options", async () => {
      strategy.addHandler("my.first.message", jest.fn(), false);
      strategy.addHandler("my.second.message", jest.fn(), false);
      strategy.addHandler("my.first.event", jest.fn(), true);

      const client = createMock<NatsConnection>();

      await strategy.subscribeToMessagePatterns(client);

      const defaultConsumerOptions = expect.objectContaining({
        queue: undefined
      });

      expect(client.subscribe).toBeCalledTimes(2);
      expect(client.subscribe).toBeCalledWith("my.first.message", defaultConsumerOptions);
      expect(client.subscribe).toBeCalledWith("my.second.message", defaultConsumerOptions);
      expect(client.subscribe).not.toBeCalledWith("my.first.event");
    });
  });

  describe("upsertStream", () => {
    it("should update the existing stream", async () => {
      const manager = createMock<JetStreamManager>({
        streams: createMock<StreamAPI>()
      });

      await strategy.upsertStream(manager, { name: "existing-stream" });

      expect(manager.streams.info).toBeCalledWith("existing-stream");
      expect(manager.streams.update).toBeCalled();
      expect(manager.streams.add).not.toBeCalled();
    });

    it("should create a new stream", async () => {
      const manager = createMock<JetStreamManager>({
        streams: createMock<StreamAPI>({
          info: async () => {
            throw new Error("stream not found");
          }
        })
      });

      await strategy.upsertStream(manager, { name: "new-stream" });

      expect(manager.streams.info).toBeCalledWith("new-stream");
      expect(manager.streams.update).not.toBeCalled();
      expect(manager.streams.add).toBeCalled();
    });

    it("should throw on unknown errors", async () => {
      const manager = createMock<JetStreamManager>({
        streams: createMock<StreamAPI>({
          info: async () => {
            throw new Error();
          }
        })
      });

      await expect(
        strategy.upsertStream(manager, { name: "existing-stream" })
      ).rejects.toBeInstanceOf(Error);

      expect(manager.streams.info).toBeCalledWith("existing-stream");
      expect(manager.streams.update).not.toBeCalled();
      expect(manager.streams.add).not.toBeCalled();
    });
  });
});
