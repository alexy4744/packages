import { BaseRequestContext } from "@alexy4744/nestjs-request-context";

export class AppRequestContext extends BaseRequestContext<AppRequestContext>() {
  data?: string;
}
