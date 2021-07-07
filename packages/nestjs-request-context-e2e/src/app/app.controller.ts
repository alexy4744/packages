import { Controller, Post, Query, UseInterceptors } from "@nestjs/common";

import { RequestContextInterceptor } from "@alexy4744/nestjs-request-context";

import { AppRequestContext } from "./app.context";

@Controller()
export class AppController {
  @Post("interceptor")
  @UseInterceptors(RequestContextInterceptor(AppRequestContext))
  interceptor(@Query("data") data: string): AppRequestContext | undefined {
    const store = AppRequestContext.getStore();

    if (store) {
      store.data = data;
    }

    return store;
  }

  @Post("middleware")
  middleware(@Query("data") data: string): AppRequestContext | undefined {
    const store = AppRequestContext.getStore();

    if (store) {
      store.data = data;
    }

    return store;
  }
}
