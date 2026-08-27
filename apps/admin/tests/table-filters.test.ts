import { describe, expect, it } from "vitest";
import {
  parseFilters,
  parseSort,
  recordQuery,
  serializeFilters,
  serializeSort,
} from "../lib/table-filters";

const cols = ["id", "name"];

describe("table filters in the URL", () => {
  it("round-trips filters and drops unknown columns and ops", () => {
    const raw = serializeFilters([
      { column: "id", op: "eq", value: "5" },
      { column: "name", op: "null", value: "" },
    ]);
    expect(raw).toBe('[["id","eq","5"],["name","null",""]]');
    expect(parseFilters(raw, cols)).toEqual([
      { column: "id", op: "eq", value: "5" },
      { column: "name", op: "null", value: "" },
    ]);
    expect(parseFilters('[["nope","eq","1"],["id","drop","1"],["id","eq",3]]', cols)).toEqual([
      { column: "id", op: "eq", value: "" },
    ]);
    expect(parseFilters("not json", cols)).toEqual([]);
    expect(serializeFilters([])).toBeUndefined();
  });
  it("round-trips sort", () => {
    expect(serializeSort({ column: "name", desc: true })).toBe("-name");
    expect(parseSort("-name", cols)).toEqual({ column: "name", desc: true });
    expect(parseSort("id", cols)).toEqual({ column: "id", desc: false });
    expect(parseSort("other", cols)).toBeNull();
    expect(serializeSort(null)).toBeUndefined();
  });
  it("builds the record link query", () => {
    expect(decodeURIComponent(recordQuery("id", "7"))).toBe('tab=data&f=[["id","eq","7"]]');
  });
});
