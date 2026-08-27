import { describe, expect, it } from "vitest";
import { filterWhere, isFilterOp, needsValue, orderBy } from "./filter";

describe("filterWhere", () => {
  it("returns nothing for no filters", () =>
    expect(filterWhere([])).toEqual({ sql: "", params: [] }));
  it("numbers placeholders from the start index", () => {
    expect(
      filterWhere(
        [
          { column: "price", op: "gte", value: "10" },
          { column: "name", op: "ilike", value: "%a%" },
          { column: "tags", op: "null", value: "" },
          { column: "id", op: "in", value: "1, 2,,3" },
        ],
        3,
        "t.",
      ),
    ).toEqual({
      sql: `WHERE t."price" >= $3 AND t."name"::text ILIKE $4 AND t."tags" IS NULL AND t."id"::text = ANY($5::text[])`,
      params: ["10", "%a%", ["1", "2", "3"]],
    });
  });
  it("quotes odd column names", () =>
    expect(filterWhere([{ column: 'a"b', op: "eq", value: "x" }]).sql).toBe(`WHERE "a""b" = $1`));
});

describe("orderBy", () => {
  it("adds the key as a tie breaker", () =>
    expect(orderBy({ column: "name", desc: true }, ["id"])).toBe(
      'ORDER BY "name" DESC NULLS LAST, "id"',
    ));
  it("does not repeat the sorted key", () =>
    expect(orderBy({ column: "id", desc: false }, ["id"], "t.")).toBe(
      'ORDER BY t."id" NULLS LAST',
    ));
  it("falls back to the key alone", () => {
    expect(orderBy(null, ["a", "b"])).toBe('ORDER BY "a", "b"');
    expect(orderBy(null, [])).toBe("");
  });
});

describe("ops", () => {
  it("knows which ops take a value", () => {
    expect(needsValue("eq")).toBe(true);
    expect(needsValue("null")).toBe(false);
    expect(isFilterOp("like")).toBe(true);
    expect(isFilterOp("drop")).toBe(false);
  });
});
