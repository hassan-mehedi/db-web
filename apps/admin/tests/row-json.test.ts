import { describe, expect, it } from "vitest";
import { prettyCell, rowObject } from "../lib/row-json";

describe("row detail", () => {
  it("pretty prints json cells and leaves other text alone", () => {
    expect(prettyCell('{"a":1}')).toBe('{\n  "a": 1\n}');
    expect(prettyCell("[1,2]")).toBe("[\n  1,\n  2\n]");
    expect(prettyCell("{not json")).toBe("{not json");
    expect(prettyCell("plain")).toBe("plain");
  });

  it("builds a row object with nulls for missing cells", () => {
    expect(rowObject(["id", "name"], ["1"])).toEqual({ id: "1", name: null });
  });
});
