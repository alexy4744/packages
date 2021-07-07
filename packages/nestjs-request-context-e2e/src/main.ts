import { NestExpressApplication } from "@nestjs/platform-express";
import { NestFactory } from "@nestjs/core";

import { AppModule } from "./app/app.module";

(async () => {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  await app.listen(3001);
})();
