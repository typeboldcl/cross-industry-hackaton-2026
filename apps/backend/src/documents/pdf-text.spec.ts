import { stripRepeatedLines } from "./pdf-text.js";

describe("stripRepeatedLines", () => {
  it("removes a line repeated on more than half of the pages from every page", () => {
    const pages = ["Header\none", "Header\ntwo", "Header\nthree", "four"];

    expect(stripRepeatedLines(pages)).toEqual(["one", "two", "three", "four"]);
  });

  it("keeps a line that appears on half or fewer of the pages", () => {
    const pages = ["Header\none", "Header\ntwo", "three", "four"];

    expect(stripRepeatedLines(pages)).toEqual(pages);
  });

  it("returns documents with fewer than 4 pages unchanged", () => {
    const pages = ["Header\none", "Header\ntwo", "Header\nthree"];

    expect(stripRepeatedLines(pages)).toBe(pages);
  });

  it("does not count blank lines", () => {
    const pages = ["one\n\n", "two\n\n", "three\n\n", "four\n\n"];

    expect(stripRepeatedLines(pages)).toEqual(pages);
  });
});
