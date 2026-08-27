import { describe, expect, it } from "vitest";
import {
  alterRolePassword,
  createRole,
  dropDatabase,
  dropRole,
  grantRole,
  isValidRoleName,
  revokeRole,
} from "./roles";

describe("isValidRoleName", () => {
  it.each(["app_admin", "recipes_dev_anon", "a"])("accepts %s", (n) =>
    expect(isValidRoleName(n)).toBe(true),
  );
  it.each(["pg_read", "Admin", "1abc", "a-b", "", "x".repeat(64)])("rejects %s", (n) =>
    expect(isValidRoleName(n)).toBe(false),
  );
});

describe("createRole", () => {
  it("nologin role without password", () =>
    expect(createRole({ name: "r", login: false, createdb: false, createrole: false })).toBe(
      'CREATE ROLE "r" NOLOGIN NOCREATEDB NOCREATEROLE',
    ));
  it("login role with password and privileges", () =>
    expect(
      createRole({ name: "r", login: true, createdb: true, createrole: true, password: "p'w" }),
    ).toBe(`CREATE ROLE "r" LOGIN CREATEDB CREATEROLE PASSWORD 'p''w'`));
  it("rejects invalid names", () =>
    expect(() =>
      createRole({ name: "pg_x", login: false, createdb: false, createrole: false }),
    ).toThrow());
});

describe("grant / revoke / drop", () => {
  it("grant", () => expect(grantRole("a", "b")).toBe('GRANT "a" TO "b"'));
  it("revoke", () => expect(revokeRole("a", "b")).toBe('REVOKE "a" FROM "b"'));
  it("drop role", () => expect(dropRole('x"y')).toBe('DROP ROLE "x""y"'));
  it("drop database", () =>
    expect(dropDatabase("recipes_dev")).toBe('DROP DATABASE "recipes_dev"'));
});

describe("alterRolePassword", () => {
  it("quotes the role and literal", () => {
    expect(alterRolePassword("blog_dev_authenticator", "p'w")).toBe(
      `ALTER ROLE "blog_dev_authenticator" PASSWORD 'p''w'`,
    );
  });
  it("rejects bad names", () => {
    expect(() => alterRolePassword("pg_x", "a")).toThrow();
  });
});
