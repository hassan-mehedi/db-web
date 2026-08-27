import { describe, expect, it } from "vitest";
import {
  bootstrapProjectEnv,
  cloneProjectEnv,
  isProdDatabase,
  isProtectedDatabase,
  isValidDatabaseName,
  planToSql,
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

describe("cloneProjectEnv", () => {
  it("creates from template and bootstraps roles for the target", () => {
    const plan = cloneProjectEnv({
      source: "blog_dev",
      target: "blog_staging",
      authenticatorPassword: "pw",
      sourceHasApiSchema: true,
    });
    expect(plan.database).toBe("blog_staging");
    expect(plan.clusterStatements[0]).toBe('CREATE DATABASE "blog_staging" TEMPLATE "blog_dev"');
    expect(plan.clusterStatements).toContain('CREATE ROLE "blog_staging_anon" NOLOGIN');
    expect(plan.databaseStatements[0]).toBe(
      'GRANT USAGE ON SCHEMA api TO "blog_staging_anon", "blog_staging_user"',
    );
    expect(planToSql(plan)).toContain('\\c "blog_staging"');
  });
  it("skips api grants when the source has no api schema", () => {
    const plan = cloneProjectEnv({
      source: "blog_dev",
      target: "blog_x",
      authenticatorPassword: "pw",
      sourceHasApiSchema: false,
    });
    expect(plan.databaseStatements).toEqual([]);
    expect(plan.clusterStatements).toHaveLength(5);
  });
  it("without a password only copies the database", () => {
    const plan = cloneProjectEnv({ source: "a_dev", target: "a_test", sourceHasApiSchema: true });
    expect(plan.clusterStatements).toEqual(['CREATE DATABASE "a_test" TEMPLATE "a_dev"']);
  });
  it("rejects same source and target", () => {
    expect(() =>
      cloneProjectEnv({ source: "a_dev", target: "a_dev", sourceHasApiSchema: false }),
    ).toThrow();
  });
});
