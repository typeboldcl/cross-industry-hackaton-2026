import { locateQuote } from "./quote-locator.js";

describe("locateQuote", () => {
  const text =
    "El Titular deberá medir el nivel freá-\ntico del acuífero\fen forma “diaria” en el pozo Pi1.";

  it("finds a quote across hyphenation, page breaks and typographic quotes", () => {
    const location = locateQuote(
      text,
      'medir el nivel freático del acuífero en forma "diaria"',
    );
    expect(location).not.toBeNull();
    expect(text.slice(location?.start, location?.end)).toBe(
      "medir el nivel freá-\ntico del acuífero\fen forma “diaria”",
    );
  });

  it("returns null when the quote is not in the text", () => {
    expect(locateQuote(text, "presentar un informe trimestral")).toBeNull();
  });
});
