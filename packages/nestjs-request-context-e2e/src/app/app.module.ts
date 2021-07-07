import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";

import { RequestContextMiddleware } from "@alexy4744/nestjs-request-context";

import { AppController } from "./app.controller";

import { AppRequestContext } from "./app.context";

@Module({
  controllers: [AppController]
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware(AppRequestContext)).forRoutes({
      method: RequestMethod.POST,
      path: "/middleware"
    });
  }
}
