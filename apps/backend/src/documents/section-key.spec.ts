import { buildPagesKey, buildSectionKey, sectionKeyId } from "./section-key.js";

describe("section keys", () => {
  it("builds keys without an id", () => {
    expect(buildSectionKey("vistos")).toBe("vistos");
    expect(buildSectionKey("resuelvo")).toBe("resuelvo");
  });

  it("builds keys with a normalized id", () => {
    expect(buildSectionKey("considerando", "10")).toBe("considerando 10");
    expect(buildSectionKey("considerando", " 4.3.2. ")).toBe(
      "considerando 4.3.2",
    );
    expect(buildSectionKey("tabla", "8.15.")).toBe("tabla 8.15");
    expect(buildSectionKey("resuelvo", "2")).toBe("resuelvo 2");
  });

  it("builds page range keys", () => {
    expect(buildPagesKey(1, 3)).toBe("paginas 1-3");
  });

  it("extracts the id from a key", () => {
    expect(sectionKeyId("considerando 4.3.2")).toBe("4.3.2");
    expect(sectionKeyId("vistos")).toBe("");
  });
});
