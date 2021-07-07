import { AsyncLocalStorage } from "async_hooks";

import { RequestContextNotEnteredException } from "./request-context.exceptions";

export const BaseRequestContext = <Store>() => {
  return class BaseRequestContextImpl {
    static readonly als = new AsyncLocalStorage<Store>();

    static enter(this: new () => Store): void {
      return BaseRequestContextImpl.als.enterWith(new this());
    }

    static getItem<K extends keyof Store>(key: K): Store[K] {
      const store = this.als.getStore();

      if (!store) {
        throw new RequestContextNotEnteredException(store);
      }

      return store[key];
    }

    static getStore(): Store | undefined {
      return this.als.getStore();
    }
  };
};
