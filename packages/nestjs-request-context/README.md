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

For use cases where a middleware is not appropriate (i.e. NestJS microservices), you can use the `RequestContextGuard` or `RequestContextInterceptor`. Refer to the request lifecycle [here](https://docs.nestjs.com/faq/request-lifecycle#summary) to decide which one is the better option.

### RequestContextGuard

The `RequestContextGuard` is ran after all middlewares, but before interceptors. This is the next best option for use cases where a middleware is not possible. `RequestContextGuard` uses the `.enterWith()` method to transition into the request context, making it a less-safer method. It is best to apply this guard before any other guards to minimize the risk of re-using the same context. The guard can be applied as any other global Nest guard.

```ts
import { APP_GUARD, Module, Post } from "@nestjs/common";

import { RequestContextGuard } from "@alexy4744/nestjs-request-context";

import { RequestContext } from "./request.context";

@Module({
  ...
  providers: [
    {
      provide: APP_GUARD,
      useClass: RequestContextGuard(RequestContext),
    },
    ...
  ]
})
export class AppModule {}
```

### RequestContextInterceptor

Interceptors always run after all middleware and guards. This may not be useful because the request context will be unaccessible in middleware and guards as it is too late in the request lifecycle. However, `RequestContextInterceptor` uses the `.run()` method to transition into the context, making it a safer option rather than using `RequestContextGuard`. The `RequestContextInterceptor` can be applied as any other Nest interceptor.

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

## Development

```bash
# Run e2e test
$ nx e2e nestjs-request-context-e2e
```

```bash
# Update version
$ nx version nestjs-request-context
```

```bash
# Build the project
$ nx build nestjs-request-context
```

```bash
# Publish new version on GitHub
$ git push --follow-tags origin master
```

```bash
# Publish new version on NPM
$ npm publish ./dist/packages/nestjs-request-context --access=public
```
