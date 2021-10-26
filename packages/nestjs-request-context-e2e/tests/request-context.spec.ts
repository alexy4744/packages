import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { Server } from "http";

import request from "supertest";

import { AppModule } from "../src/app/app.module";

describe("RequestContext", () => {
  let server: Server;
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = module.createNestApplication();
    server = app.getHttpServer();

    await app.init();
  });

  afterAll(() => app.close());

  it("should set the data in request context with guard", async () => {
    const data = String(Math.random());

    const response = await request(server).get("/guard").query({ data });

    expect(response.body).toEqual(
      expect.objectContaining({
        data
      })
    );
  });

  it("should set the data in request context with interceptor", async () => {
    const data = String(Math.random());

    const response = await request(server).get("/interceptor").query({ data });

    expect(response.body).toEqual(
      expect.objectContaining({
        data
      })
    );
  });

  it("should set the data in request context with middleware", async () => {
    const data = String(Math.random());

    const response = await request(server).get("/middleware").query({ data });

    expect(response.body).toEqual(
      expect.objectContaining({
        data
      })
    );
  });

  it("should return an empty body if request context is not entered", async () => {
    const response = await request(server).get("/none");

    expect(response.body).toEqual({});
  });
});
