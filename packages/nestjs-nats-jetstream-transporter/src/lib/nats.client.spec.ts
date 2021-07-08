import { JetStreamClient, JSONCodec, Msg, NatsConnection } from "nats";

import { ReadPacket, WritePacket } from "@nestjs/microservices";

import { NatsClient } from "./nats.client";

import { createMock } from "@golevelup/ts-jest";

describe("NatsClient", () => {
  let client: NatsClient;

  beforeEach(() => {
    client = new NatsClient();
  });

  describe("connect", () => {
    it("should return a new connnection", async () => {
      const jetstreamClient = createMock<JetStreamClient>();

      const connection = createMock<NatsConnection>({
        getServer: () => "nats://test:4222",
        jetstream: () => jetstreamClient
      });

      const createNatsConnectionSpy = jest
        .spyOn(client, "createNatsConnection")
        .mockResolvedValue(connection);

      const handleStatusUpdatesSpy = jest.spyOn(client, "handleStatusUpdates");

      const loggerSpy = jest.spyOn(client["logger"], "log");

      await expect(client.connect()).resolves.toStrictEqual(connection);

      expect(client["connection"]).toStrictEqual(connection);
      expect(client["jetstreamClient"]).toStrictEqual(jetstreamClient);

      expect(createNatsConnectionSpy).toBeCalledTimes(1);

      expect(handleStatusUpdatesSpy).toBeCalledTimes(1);
      expect(handleStatusUpdatesSpy).toBeCalledWith(client["connection"]);

      expect(loggerSpy).toBeCalledTimes(1);
      expect(loggerSpy).toBeCalledWith("Connected to nats://test:4222");
    });

    it("should return the existing connection", async () => {
      const connection = createMock<NatsConnection>();

      const createNatsConnectionSpy = jest.spyOn(client, "createNatsConnection");

      client["connection"] = connection;

      await expect(client.connect()).resolves.toStrictEqual(connection);

      expect(createNatsConnectionSpy).not.toBeCalled();
    });
  });

  describe("close", () => {
    it("should drain and cleanup", async () => {
      const connection = createMock<NatsConnection>({
        drain: jest.fn()
      });

      client["connection"] = connection;
      client["jetstreamClient"] = createMock<JetStreamClient>();

      await client.close();

      expect(connection.drain).toBeCalledTimes(1);

      expect(client["connection"]).toBeUndefined();
      expect(client["jetstreamClient"]).toBeUndefined();
    });
  });

  describe("getConnection", () => {
    it("should return the current connection", () => {
      const connection = createMock<NatsConnection>();

      client["connection"] = connection;

      expect(client.getConnection()).toStrictEqual(connection);
    });
  });

  describe("getJetStreamClient", () => {
    it("should return the current jetstream client", () => {
      const jetstreamClient = createMock<JetStreamClient>();

      client["jetstreamClient"] = jetstreamClient;

      expect(client.getJetStreamClient()).toStrictEqual(jetstreamClient);
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

      const loggerSpy = jest.spyOn(client["logger"], "debug");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.handleStatusUpdates(connection as any);

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

      const loggerSpy = jest.spyOn(client["logger"], "error");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.handleStatusUpdates(connection as any);

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

      const loggerSpy = jest.spyOn(client["logger"], "log");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.handleStatusUpdates(connection as any);

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

      const loggerSpy = jest.spyOn(client["logger"], "warn");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.handleStatusUpdates(connection as any);

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

      const loggerSpy = jest.spyOn(client["logger"], "verbose");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await client.handleStatusUpdates(connection as any);

      expect(loggerSpy).toBeCalledTimes(1);
      expect(loggerSpy).toBeCalledWith(
        `(update): ${JSON.stringify({ added: ["1"], deleted: ["2"] })}`
      );
    });
  });

  describe("dispatchEvent", () => {
    const codec = JSONCodec();

    let client: NatsClient;

    beforeEach(() => {
      client = new NatsClient({
        codec
      });
    });

    it("should throw error if jetstream client is undefined", async () => {
      const packet: ReadPacket = {
        data: "hello world",
        pattern: "my-event"
      };

      client["jetstreamClient"] = undefined;

      await expect(client["dispatchEvent"](packet)).rejects.toThrow(Error);
    });

    it("should publish the event with jetstream", async () => {
      const packet: ReadPacket = {
        data: "hello world",
        pattern: "my-event"
      };

      const publishFn = jest.fn();

      client["jetstreamClient"] = createMock<JetStreamClient>({
        publish: publishFn
      });

      await client["dispatchEvent"](packet);

      expect(publishFn).toBeCalledTimes(1);
      expect(publishFn).toBeCalledWith(packet.pattern, codec.encode(packet.data));
    });
  });

  describe("publish", () => {
    const codec = JSONCodec();

    let client: NatsClient;

    beforeEach(() => {
      client = new NatsClient({
        codec
      });
    });

    it("should throw error if connection is undefined", () => {
      const packet: ReadPacket = {
        data: "hello world",
        pattern: "my-event"
      };

      client["connection"] = undefined;

      expect(() => client["publish"](packet, () => undefined)).toThrow(Error);
    });

    it("should publish the message", (complete) => {
      const readPacket: ReadPacket = {
        data: {
          hello: "world"
        },
        pattern: "my-event"
      };

      const writePacket: WritePacket = {
        response: {
          goodbye: "world"
        },
        isDisposed: true
      };

      const callback = (packet: WritePacket) => {
        expect(packet.response).toEqual(writePacket.response);

        complete();
      };

      const requestFn = jest.fn().mockResolvedValue(
        createMock<Msg>({
          data: codec.encode(writePacket)
        })
      );

      client["connection"] = createMock<NatsConnection>({
        request: requestFn
      });

      client["publish"](readPacket, callback);

      expect(requestFn).toBeCalledTimes(1);
      expect(requestFn).toBeCalledWith(readPacket.pattern, codec.encode(readPacket.data));
    });
  });
});
