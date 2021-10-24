export class RequestContextException extends Error {}

export class RequestContextNotEnteredException extends RequestContextException {
  constructor(store: unknown = undefined) {
    super(
      `Request context store is ${store}, ensure that enter() or run() is called before accessing store!`
    );
  }
}
