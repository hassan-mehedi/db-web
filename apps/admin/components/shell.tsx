import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "./sign-out-button";

export function Shell({
  crumbs,
  children,
}: {
  crumbs: { label: string; href?: string }[];
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b px-6 py-3 text-sm">
        <nav className="flex items-center gap-2">
          <Link href="/" className="font-semibold">
            db-web
          </Link>
          {crumbs.map((c) => (
            <span key={c.label} className="flex items-center gap-2">
              <span className="text-muted-foreground">/</span>
              {c.href ? (
                <Link href={c.href} className="font-mono hover:underline">
                  {c.label}
                </Link>
              ) : (
                <span className="font-mono">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-4">
          <Link href="/roles" className="text-muted-foreground hover:text-foreground">
            Roles
          </Link>
          <SignOutButton />
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
