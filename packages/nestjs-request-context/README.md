# NestJS Request Context

Keep track of request-level data in NestJS using AsyncLocalStorage

## Prerequisites
 - [Node.js](https://nodejs.org/en/) >= 16.0.0

## Installation

```bash
$ npm install @alexy4744/nestjs-request-context
```

## Usage

### RequestContext

First, create a class that extends `RequestContext`. This class will hold your request-level data.

```ts
import { BaseRequestContext } from "@alexy4744/nestjs-request-context";

export class RequestContext extends BaseRequestContext<RequestContext>() {
  data?: string;
}
```

### RequestContextMiddleware

Next, apply `RequestContextMiddleware` as a global middleware and pass in our request context as a parameter:

```ts
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from "@nestjs/common";

import { RequestContextMiddleware } from "@alexy4744/nestjs-request-context";

import { RequestContext } from "./request.context";

@Module()
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware(RequestContext)).forRoutes({
      method: RequestMethod.ALL,
      path: "*"
    });
  }
}
```

You can now access the request context by importing it anywhere in your application.

```ts
import { Controller, Get } from "@nestjs/common";

import { RequestContext } from "./request.context";

@Controller()
export class AppController {
  @Get()
  get(): RequestContext {
    const store = RequestContext.getStore();

    store.data = "test";

    const data = RequestContext.getItem("data");
    
    console.log(item); // "test"

    return store;
  }
}
```

### RequestContextInterceptor

For use cases where a middleware is not appropriate (i.e. NestJS microservices), you can use the `RequestContextInterceptor`. It can be applied normally like any other interceptor. Note that interceptors run after guards, refer to the request lifecycle [here](https://docs.nestjs.com/faq/request-lifecycle#summary).

```ts
import { Controller, Post, Query, UseInterceptors } from "@nestjs/common";

import { RequestContextInterceptor } from "@alexy4744/nestjs-request-context";

import { RequestContext } from "./request.context";

@Controller()
export class AppController {
  @Get()
  @UseInterceptors(RequestContextInterceptor(RequestContext))
  get(): RequestContext | undefined {
    const store = RequestContext.getStore();

    store.data = "test";

    const data = RequestContext.getItem("data");
    
    console.log(item); // "test"

    return store;
  }
}
```

## Tests

Run tests using the following commands:

```bash
$ npm run test
```
