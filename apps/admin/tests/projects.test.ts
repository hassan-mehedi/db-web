import { describe, expect, it } from "vitest";
import {
  databaseName,
  groupByProject,
  isValidProjectEnv,
  parseDatabaseName,
} from "../lib/projects";
import { envPath, legacyRedirect, tablePath } from "../lib/routes";

describe("parseDatabaseName", () => {
  it("splits on the last underscore", () => {
    expect(parseDatabaseName("blog_dev")).toEqual({
      project: "blog",
      env: "dev",
      database: "blog_dev",
    });
    expect(parseDatabaseName("my_app_prod")).toEqual({
      project: "my_app",
      env: "prod",
      database: "my_app_prod",
    });
  });
  it("keeps names without an underscore as a project with empty env", () => {
    expect(parseDatabaseName("legacy")).toEqual({ project: "legacy", env: "", database: "legacy" });
    expect(parseDatabaseName("trailing_")).toEqual({
      project: "trailing_",
      env: "",
      database: "trailing_",
    });
  });
  it("round-trips with databaseName", () => {
    const { project, env } = parseDatabaseName("shop_staging");
    expect(databaseName(project, env)).toBe("shop_staging");
  });
});

describe("isValidProjectEnv", () => {
  it("accepts lowercase project and env", () => {
    expect(isValidProjectEnv("blog", "dev")).toBe(true);
    expect(isValidProjectEnv("shop2", "prod")).toBe(true);
  });
  it("rejects bad parts", () => {
    expect(isValidProjectEnv("Blog", "dev")).toBe(false);
    expect(isValidProjectEnv("blog", "")).toBe(false);
    expect(isValidProjectEnv("blog", "de_v")).toBe(false);
    expect(isValidProjectEnv("1blog", "dev")).toBe(false);
    expect(isValidProjectEnv("my_app", "dev")).toBe(false);
  });
});

describe("groupByProject", () => {
  it("groups and orders envs dev, test, staging, prod, then others", () => {
    const rows = ["b_prod", "a_x", "b_dev", "a_dev", "b_staging"].map((datname) => ({ datname }));
    const groups = groupByProject(rows);
    expect(groups.map((g) => g.name)).toEqual(["a", "b"]);
    expect(groups[1]?.envs.map((e) => e.env)).toEqual(["dev", "staging", "prod"]);
    expect(groups[0]?.envs.map((e) => e.env)).toEqual(["dev", "x"]);
  });
});

describe("legacyRedirect", () => {
  it("maps old /db paths onto /projects", () => {
    expect(legacyRedirect("/db/blog_dev")).toBe("/projects/blog/dev");
    expect(legacyRedirect("/db/blog_dev/query")).toBe("/projects/blog/dev/query");
    expect(legacyRedirect("/db/blog_dev/diagram")).toBe("/projects/blog/dev/diagram");
    expect(legacyRedirect("/db/blog_dev/public/items")).toBe(
      "/projects/blog/dev/tables/public/items",
    );
    expect(legacyRedirect("/projects")).toBeNull();
  });
  it("path helpers agree", () => {
    expect(envPath("blog_dev")).toBe("/projects/blog/dev");
    expect(tablePath("blog_dev", "public", "items")).toBe("/projects/blog/dev/tables/public/items");
  });
});
