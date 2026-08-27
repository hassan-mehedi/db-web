import Link from "next/link";
import type { ReactNode } from "react";

export interface Crumb {
  label: string;
  href?: string;
}

export function AppShell({
  crumbs,
  actions,
  children,
  wide = false,
}: {
  database?: string;
  crumbs: Crumb[];
  actions?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <>
      <header className="flex h-12 items-center gap-2 border-b px-6 text-sm">
        <nav className="flex min-w-0 items-center gap-2 overflow-hidden">
          <Link href="/projects" className="text-muted-foreground hover:text-foreground">
            Projects
          </Link>
          {crumbs.map((c) => (
            <span key={`${c.label}-${c.href ?? ""}`} className="flex items-center gap-2">
              <span className="text-muted-foreground/60">/</span>
              {c.href ? (
                <Link href={c.href} className="truncate font-mono hover:text-primary">
                  {c.label}
                </Link>
              ) : (
                <span className="truncate font-mono">{c.label}</span>
              )}
            </span>
          ))}
        </nav>
        {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
      </header>
      <main className={wide ? "flex min-h-0 flex-1 flex-col" : "mx-auto w-full max-w-6xl p-6"}>
        {children}
      </main>
    </>
  );
}
