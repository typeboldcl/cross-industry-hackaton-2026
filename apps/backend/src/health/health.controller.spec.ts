import { Test } from "@nestjs/testing";
import { HealthController } from "./health.controller.js";

describe("HealthController", () => {
  it("reports the service as up", async () => {
    const module = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    expect(module.get(HealthController).check()).toEqual({ status: "ok" });
  });
});
