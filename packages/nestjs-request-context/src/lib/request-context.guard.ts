import { CanActivate, mixin } from "@nestjs/common";

import { BaseRequestContext } from "./request-context.base";

export const RequestContextGuard = (store: ReturnType<typeof BaseRequestContext>) => {
  class RequestContextMixinGuard implements CanActivate {
    canActivate(): boolean {
      store.enter();

      return true;
    }
  }

  return mixin(RequestContextMixinGuard);
};
