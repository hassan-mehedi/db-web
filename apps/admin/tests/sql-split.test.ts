import { describe, expect, it } from "vitest";
import { splitStatements, statementAt } from "../lib/sql-split";

describe("splitStatements", () => {
  it("splits on semicolons and drops empty parts", () => {
    expect(splitStatements("select 1; select 2;;\n").map((s) => s.text)).toEqual([
      "select 1",
      "select 2",
    ]);
  });

  it("ignores semicolons in strings, comments and dollar quotes", () => {
    const sql = [
      "select ';' as a; -- trailing; comment",
      '/* block; comment */ select "x;y" from t;',
      "create function f() returns void as $$ begin perform 1; end $$ language plpgsql;",
      "do $body$ begin null; end $body$",
    ].join("\n");
    expect(splitStatements(sql).map((s) => s.text)).toEqual([
      "select ';' as a",
      '-- trailing; comment\n/* block; comment */ select "x;y" from t',
      "create function f() returns void as $$ begin perform 1; end $$ language plpgsql",
      "do $body$ begin null; end $body$",
    ]);
  });

  it("keeps offsets for the statement under the cursor", () => {
    const sql = "select 1;\n\nselect 2;\nselect 3";
    expect(statementAt(sql, 0)?.text).toBe("select 1");
    expect(statementAt(sql, 10)?.text).toBe("select 2");
    expect(statementAt(sql, 15)?.text).toBe("select 2");
    expect(statementAt(sql, sql.length)?.text).toBe("select 3");
    expect(statementAt("   ", 1)).toBeNull();
  });
});
