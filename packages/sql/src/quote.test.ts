import { describe, expect, it } from "vitest";
import { quoteIdent, quoteLiteral, quoteQualified } from "./quote";

describe("quoteIdent", () => {
  it("quotes plain names", () => expect(quoteIdent("users")).toBe('"users"'));
  it("quotes reserved words", () => expect(quoteIdent("select")).toBe('"select"'));
  it("doubles embedded quotes", () => expect(quoteIdent('a"b')).toBe('"a""b"'));
  it("keeps unicode", () => expect(quoteIdent("tábla")).toBe('"tábla"'));
  it("keeps pg_ prefix untouched", () => expect(quoteIdent("pg_x")).toBe('"pg_x"'));
  it("rejects empty", () => expect(() => quoteIdent("")).toThrow());
  it("rejects NUL", () => expect(() => quoteIdent("a\0b")).toThrow());
  it("neutralises injection attempts", () =>
    expect(quoteIdent('x"; DROP TABLE y; --')).toBe('"x""; DROP TABLE y; --"'));
});

describe("quoteQualified", () => {
  it("joins schema and table", () => expect(quoteQualified("api", "t")).toBe('"api"."t"'));
});

describe("quoteLiteral", () => {
  it("null", () => expect(quoteLiteral(null)).toBe("NULL"));
  it("numbers", () => expect(quoteLiteral(1.5)).toBe("1.5"));
  it("rejects NaN", () => expect(() => quoteLiteral(Number.NaN)).toThrow());
  it("booleans", () => expect(quoteLiteral(true)).toBe("TRUE"));
  it("strings", () => expect(quoteLiteral("a")).toBe("'a'"));
  it("empty string", () => expect(quoteLiteral("")).toBe("''"));
  it("doubles single quotes", () => expect(quoteLiteral("it's")).toBe("'it''s'"));
  it("uses E-strings for backslashes", () => expect(quoteLiteral("a\\b")).toBe("E'a\\\\b'"));
  it("rejects NUL", () => expect(() => quoteLiteral("a\0")).toThrow());
});
