# NestJS NATS JetStream Transporter

A NATS transporter for NestJS that takes advantage of [JetStream](https://docs.nats.io/jetstream/jetstream) for event patterns.

- [NestJS NATS JetStream Transporter](#nestjs-nats-jetstream-transporter)
  - [Installation](#installation)
  - [Publishing Messages](#publishing-messages)
    - [Request-Reply](#request-reply)
    - [Event-Based](#event-based)
  - [Receiving Messages](#receiving-messages)
    - [Customizing JetStream consumer options](#customizing-jetstream-consumer-options)
    - [NACK and TERM JetStream messages](#nack-and-term-jetstream-messages)
    - [Queue Groups](#queue-groups)
  - [Tests](#tests)
  
## Installation

```bash
$ npm install @alexy4744/nestjs-nats-jetstream-transporter nats@2.2.0
```

⚠️ This library uses [NATS.js](https://github.com/nats-io/nats.js#jetstream), which means that the underlying JetStream API is subject to change and does not follow semver. It is recommended to use `nats@2.2.0` until the JetStream API is out of beta as it has been fully tested with this package.

## Publishing Messages

The `NatsClient` works mostly the same with the built-in NATS transporter for NestJS. The only difference is that you must instantiate `NatsClient` yourself.

### Request-Reply
```ts
// main.ts
import { NatsTransportStrategy } from "nestjs-nats-jetstream-transporter";

const app = await NestFactory.createMicroservice(AppModule, {
  strategy: new NatsTransportStrategy()
});

await app.listenAsync();
```

```ts
// math.controller.ts
import { NatsClient } from "nestjs-nats-jetstream-transporter";

@Controller()
export class MathController {
  private readonly client = new NatsClient();

  accumulate(): Observable<number> {
    return this.client.send<number>("sum", [1, 2, 3]);
  }
}
```

### Event-Based
```ts
// main.ts
import { NatsTransportStrategy } from "nestjs-nats-jetstream-transporter";

const app = await NestFactory.createMicroservice(AppModule, {
  strategy: new NatsTransportStrategy({
    // Create a stream with a subject called "orders.created"
    // This is important later on when we publish an event with NatsClient
    streams: [
      {
        name: "orders-events",
        subjects: ["orders.created"]
      }
    ]
  })
});

await app.listenAsync();
```

```ts
// orders.controller.ts
import { NatsClient } from "nestjs-nats-jetstream-transporter";

@Controller()
export class OrdersController {
  private readonly client = new NatsClient();

  constructor(private readonly ordersService: OrdersService) {}

  async create(): Promise<void> {
    const order = await this.ordersService.create();

    this.client.emit("orders.created", order);
  }
}
```

## Receiving Messages

There are no special changes needed to receive messages. Just use the `@EventPattern()` and `@MessagePattern()` decorators provided by NestJS.

`@Ctx()` works exactly the same, however you should use the `NatsContext` provided by this package as the parameter type. It exposes an additional `getMessage()` method that returns the original message object if needed.

### Customizing JetStream consumer options

You can customize how the JetStream push consumer behaves. One example is making the consumer durable to survive application restarts. Another example is taking advantage of distributed queues for horozontal scaling.

Read more about JetStream consumers [here](https://docs.nats.io/jetstream/concepts/consumers), and refer to the underlying API [here](https://github.com/nats-io/nats.deno/blob/main/nats-base-client/types.ts#L330).

```ts
const app = await NestFactory.createMicroservice(AppModule, {
  strategy: new NatsTransportStrategy({
    consumer: (options) => {
      options.durable("my-durable-name");

      // When using a queue group with JetStream, it is necessary that deliverTo() and queue() uses the same name.
      // This is a requirement for NATS.js v2.2.0, see this issue for more details:
      // https://github.com/nats-io/nats.js/issues/446
      options.deliverTo("my-queue-group");
      options.queue("my-queue-group");
    }
  })
});
```

### NACK and TERM JetStream messages

By default, all JetStream messages are automatically acknowledged. However, you can also NACK and TERM the message by returning the respective symbols from your application.

Returning `NACK` will ask for the message to be redelivered, while `TERM` will terminate future deliveries of the message.

```ts
// shipping.controller.ts
import { NACK, TERM } from "nestjs-nats-jetstream-transporter";

@Controller()
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  @EventPattern("orders.created")
  handleCreatedOrder(order) {
    // If a shipment cannot be scheduled at this time, then ask for the message to be redelivered
    if (this.shippingService.isBusy()) {
      return NACK;
    }

    // If a shipment already exists for this order, then terminate the redelivery of this message
    if (this.shippingService.exists(order)) {
      return TERM;
    }

    this.shippingService.scheduleShipment(order);
    
    // Otherwise, the message will be auto-acked
  }
}
```

If the handler for your event pattern throws an error, the message will automatically be terminated. You can change this behavior by providing an `onError` function to the transport strategy options.

```ts
const app = await NestFactory.createMicroservice(AppModule, {
  strategy: new NatsTransportStrategy({
    // Messages that caused an exception will be acked instead
    onError: (message) => message.ack()
  })
});
```

### Queue Groups

You can specify a queue group name to enable [distributed queues](https://docs.nats.io/nats-concepts/queue). This will load balance message delivery across all other application instances with the same queue group name. It makes horozontal scaling simple as you can scale up by running another instance of your application with no additional configuration.

```ts
const app = await NestFactory.createMicroservice(AppModule, {
  strategy: new NatsTransportStrategy({
    queue: "my-queue-group"
  })
});
```

If you want to enable this functionality for event patterns, you must also specify the queue group name using the JetStream consumer options builder.

```ts
const app = await NestFactory.createMicroservice(AppModule, {
  strategy: new NatsTransportStrategy({
    consumer: (options) => {
      // When using a queue group with JetStream, it is necessary that deliverTo() and queue() uses the same name.
      // This is a requirement for NATS.js v2.2.0, see this issue for more details:
      // https://github.com/nats-io/nats.js/issues/446
      options.deliverTo("my-queue-group");
      options.queue("my-queue-group")
    },
    queue: "my-queue-group"
  })
});
```

## Development

```bash
# Run tests
$ nx test nestjs-nats-jetstream-transporter
```

```bash
# Update version
$ nx version nestjs-nats-jetstream-transporter
```

```bash
# Build the project
$ nx build nestjs-nats-jetstream-transporter
```

```bash
# Publish new version on GitHub
$ git push --follow-tags origin master
```

```bash
# Publish new version on NPM
$ npm publish ./dist/packages/nestjs-nats-jetstream-transporter --access=public
```

