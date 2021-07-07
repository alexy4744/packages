import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";

import { Server } from "http";

import request from "supertest";

import { AppModule } from "../src/app/app.module";

describe("RequestContext", () => {
  let server: Server;
  let app: INestApplication;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = module.createNestApplication();
    server = app.getHttpServer();

    await app.init();
  });

  afterEach(() => app.close());

  it("should set the data in request context with interceptor", async () => {
    const response = await request(server).post("/interceptor").query({ data: "test" });

    expect(response.body).toEqual(
      expect.objectContaining({
        data: "test"
      })
    );
  });

  it("should set the data in request context with middleware", async () => {
    const response = await request(server).post("/middleware").query({ data: "test" });

    expect(response.body).toEqual(
      expect.objectContaining({
        data: "test"
      })
    );
  });
});
