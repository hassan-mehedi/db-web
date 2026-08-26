import { describe, expect, it } from "vitest";
import {
  addCheck,
  addForeignKey,
  addUnique,
  createIndex,
  dropConstraint,
  dropIndex,
} from "./constraints";

describe("createIndex", () => {
  it("default name and btree", () =>
    expect(
      createIndex({
        schema: "public",
        table: "items",
        columns: ["name"],
        unique: false,
        method: "btree",
      }),
    ).toBe('CREATE INDEX "items_name_idx" ON "public"."items" USING btree ("name")'));
  it("unique multi-column with explicit name", () =>
    expect(
      createIndex({
        schema: "api",
        table: "t",
        name: "my_idx",
        columns: ["a", "b"],
        unique: true,
        method: "btree",
      }),
    ).toBe('CREATE UNIQUE INDEX "my_idx" ON "api"."t" USING btree ("a", "b")'));
  it("gin", () =>
    expect(
      createIndex({
        schema: "public",
        table: "items",
        columns: ["tags"],
        unique: false,
        method: "gin",
      }),
    ).toContain("USING gin"));
  it("rejects empty or duplicate columns and bad method", () => {
    expect(() =>
      createIndex({ schema: "s", table: "t", columns: [], unique: false, method: "btree" }),
    ).toThrow();
    expect(() =>
      createIndex({ schema: "s", table: "t", columns: ["a", "a"], unique: false, method: "btree" }),
    ).toThrow();
    expect(() =>
      // @ts-expect-error runtime check
      createIndex({ schema: "s", table: "t", columns: ["a"], unique: false, method: "x; drop" }),
    ).toThrow();
  });
  it("dropIndex", () =>
    expect(dropIndex("public", "items_name_idx")).toBe('DROP INDEX "public"."items_name_idx"'));
});

describe("addForeignKey", () => {
  it("builds with actions", () =>
    expect(
      addForeignKey({
        schema: "api",
        table: "posts",
        columns: ["author_id"],
        refSchema: "api",
        refTable: "users",
        refColumns: ["id"],
        onDelete: "CASCADE",
        onUpdate: "NO ACTION",
      }),
    ).toBe(
      'ALTER TABLE "api"."posts" ADD CONSTRAINT "posts_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "api"."users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION',
    ));
  it("rejects mismatched column counts", () =>
    expect(() =>
      addForeignKey({
        schema: "s",
        table: "t",
        columns: ["a", "b"],
        refSchema: "s",
        refTable: "u",
        refColumns: ["id"],
        onDelete: "NO ACTION",
        onUpdate: "NO ACTION",
      }),
    ).toThrow());
});

describe("unique, check, drop", () => {
  it("unique", () =>
    expect(addUnique({ schema: "s", table: "t", columns: ["email"] })).toBe(
      'ALTER TABLE "s"."t" ADD CONSTRAINT "t_email_key" UNIQUE ("email")',
    ));
  it("check", () =>
    expect(
      addCheck({ schema: "s", table: "t", name: "price_positive", expression: "price > 0" }),
    ).toBe('ALTER TABLE "s"."t" ADD CONSTRAINT "price_positive" CHECK (price > 0)'));
  it("check rejects separators", () =>
    expect(() =>
      addCheck({ schema: "s", table: "t", name: "c", expression: "1; drop" }),
    ).toThrow());
  it("drop", () =>
    expect(dropConstraint("s", "t", "t_pkey")).toBe(
      'ALTER TABLE "s"."t" DROP CONSTRAINT "t_pkey"',
    ));
});
