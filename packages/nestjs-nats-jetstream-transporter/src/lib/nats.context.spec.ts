import { Msg, MsgHdrs } from "nats";

import { NatsContext } from "./nats.context";

import { createMock } from "@golevelup/ts-jest";

describe("NatsContext", () => {
  it("should return message headers", () => {
    const headers = createMock<MsgHdrs>();

    const message = createMock<Msg>({
      headers
    });

    const context = new NatsContext([message]);

    expect(context.getHeaders()).toStrictEqual(headers);
  });

  it("should return message object", () => {
    const message = createMock<Msg>();

    const context = new NatsContext([message]);

    expect(context.getMessage()).toStrictEqual(message);
  });

  it("should return message subject", () => {
    const subject = "my-subject";

    const message = createMock<Msg>({
      subject
    });

    const context = new NatsContext([message]);

    expect(context.getSubject()).toStrictEqual(subject);
  });
});
