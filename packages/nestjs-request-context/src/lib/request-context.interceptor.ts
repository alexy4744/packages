import { CallHandler, ExecutionContext, NestInterceptor, Type, mixin } from "@nestjs/common";

import { Observable } from "rxjs";

import { BaseRequestContext } from "./request-context.base";

export const RequestContextInterceptor = (
  store: ReturnType<typeof BaseRequestContext>
): Type<NestInterceptor> => {
  class RequestContextMixinInterceptor implements NestInterceptor {
    intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
      return new Observable((subscriber) => {
        store.run(() => {
          next
            .handle()
            .pipe()
            .subscribe({
              complete: () => subscriber.complete(),
              error: (err) => subscriber.error(err),
              next: (res) => subscriber.next(res)
            });
        });
      });
    }
  }

  return mixin(RequestContextMixinInterceptor);
};
