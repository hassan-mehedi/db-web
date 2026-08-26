import { describe, expect, it } from "vitest";
import {
  bootstrapProjectEnv,
  isProdDatabase,
  isProtectedDatabase,
  isValidDatabaseName,
} from "./index";

describe("isValidDatabaseName", () => {
  it.each(["recipes_dev", "tracker_prod", "a1_b2"])("accepts %s", (n) =>
    expect(isValidDatabaseName(n)).toBe(true),
  );
  it.each(["Recipes_dev", "recipes", "_dev", "recipes-dev", "1abc_dev", ""])("rejects %s", (n) =>
    expect(isValidDatabaseName(n)).toBe(false),
  );
});

describe("isProdDatabase", () => {
  it("detects _prod suffix", () => {
    expect(isProdDatabase("x_prod")).toBe(true);
    expect(isProdDatabase("x_dev")).toBe(false);
  });
});

describe("bootstrapProjectEnv", () => {
  it("matches the reference plan", () => {
    expect(
      bootstrapProjectEnv({ database: "recipes_dev", authenticatorPassword: "p'w" }),
    ).toMatchSnapshot();
  });
  it("rejects invalid names", () =>
    expect(() => bootstrapProjectEnv({ database: "bad", authenticatorPassword: "x" })).toThrow());
});

describe("isProtectedDatabase", () => {
  it.each(["postgres", "db_web_meta", "template0", "template1"])("protects %s", (n) =>
    expect(isProtectedDatabase(n)).toBe(true),
  );
  it("allows project databases", () => expect(isProtectedDatabase("recipes_dev")).toBe(false));
});
