import {
  normalizeDocumentNumber,
  numberFromFilename,
  numberFromText,
} from "./document-number.js";

describe("document numbers", () => {
  it("reads the RCA number from the SEIA filename", () => {
    expect(
      numberFromFilename("RCA_N_202410001185__Piscicultura_Aucha_.pdf"),
    ).toBe("202410001185");
    expect(
      numberFromFilename("RES SANITARIA SUSPEL 14_09_2023.pdf"),
    ).toBeNull();
  });

  it("reads a sanitary resolution number from its header", () => {
    expect(
      numberFromText(["RESOLUCIÓN EXENTA N° : 2310322819\nFECHA : 14/09/2023"]),
    ).toBe("2310322819");
  });

  it("ignores the RCA placeholder", () => {
    expect(numberFromText(["RESOLUCIÓN EXENTA N° <NUM_RES>"])).toBeNull();
  });

  it("normalizes the short form", () => {
    expect(normalizeDocumentNumber("049/2017")).toBe("49/2017");
  });
});
