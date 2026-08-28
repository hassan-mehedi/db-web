import { describe, expect, it } from "vitest";
import { csvFileName, toCsv } from "../lib/csv";

describe("csv", () => {
  it("quotes fields with commas, quotes and newlines and leaves NULL empty", () => {
    expect(
      toCsv(
        ["id", "name"],
        [
          ["1", 'a,"b"'],
          ["2", null],
          ["3", "x\ny"],
        ],
      ),
    ).toBe('id,name\r\n1,"a,""b"""\r\n2,\r\n3,"x\ny"\r\n');
  });
  it("builds a safe file name", () => {
    expect(csvFileName("blog_dev", "public", "posts")).toBe("blog_dev-public-posts.csv");
    expect(csvFileName("a b", 'c"d')).toBe("a_b-c_d.csv");
  });
});
