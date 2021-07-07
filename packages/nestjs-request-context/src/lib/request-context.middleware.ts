import { NestMiddleware, Type, mixin } from "@nestjs/common";

import { BaseRequestContext } from "./request-context.base";

export const RequestContextMiddleware = (
  store: ReturnType<typeof BaseRequestContext>
): Type<NestMiddleware> => {
  class RequestContextMixinMiddleware implements NestMiddleware {
    use(_req: unknown, _res: unknown, next: () => void): void {
      store.enter();

      next();
    }
  }

  return mixin(RequestContextMixinMiddleware);
};
