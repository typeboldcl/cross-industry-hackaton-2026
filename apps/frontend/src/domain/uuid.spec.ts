import { uuid } from "./uuid";

describe("uuid", () => {
  it("returns a v4 UUID without crypto.randomUUID", () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
    try {
      expect(uuid()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
    } finally {
      Object.defineProperty(crypto, "randomUUID", {
        value: original,
        configurable: true,
      });
    }
  });
});
