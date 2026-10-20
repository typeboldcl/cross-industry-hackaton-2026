import type { HealthStatus } from "@hackaton/contracts";
import { Controller, Get } from "@nestjs/common";

@Controller("health")
export class HealthController {
  @Get()
  check(): HealthStatus {
    return { status: "ok" };
  }
}
