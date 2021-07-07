export class RequestContextException extends Error {}

export class RequestContextNotEnteredException extends RequestContextException {
  constructor(store: unknown = undefined) {
    super(
      `Request context store is ${store}, ensure that enter() is called first before accessing items!`
    );
  }
}
