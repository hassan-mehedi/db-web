"use client";

import {
  Activity,
  Cable,
  ChevronDown,
  Database,
  FolderKanban,
  GitFork,
  Menu,
  Settings,
  Shield,
  Table2,
  Terminal,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";
import { EnvBadge } from "./env-badge";
import { SignOutButton } from "./sign-out-button";

export interface SidebarProject {
  name: string;
  envs: { env: string; database: string }[];
}

export interface SidebarProps {
  projects: SidebarProject[];
  current?: { project: string; env: string; database: string } | undefined;
  backupsUrl?: string | undefined;
}

const ENV_NAV = [
  { key: "", label: "Overview", icon: Database },
  { key: "/tables", label: "Tables", icon: Table2 },
  { key: "/query", label: "SQL editor", icon: Terminal },
  { key: "/diagram", label: "Diagram", icon: GitFork },
  { key: "/connect", label: "Connect", icon: Cable },
  { key: "/monitoring", label: "Monitoring", icon: Activity },
  { key: "/roles", label: "Roles", icon: Users },
  { key: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar({ projects, current, backupsUrl }: SidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const base = current ? `/projects/${current.project}/${current.env}` : null;

  const content = (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center gap-2 border-b border-sidebar-border px-4">
        <Link href="/projects" className="flex items-center gap-2 font-semibold">
          <span className="inline-block size-2.5 rounded-sm bg-primary" />
          db-web
        </Link>
        <button
          type="button"
          className="ml-auto md:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close menu"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="border-b border-sidebar-border p-3">
        <ProjectSwitcher projects={projects} current={current} />
      </div>

      <nav className="flex-1 overflow-y-auto p-2 text-sm">
        {base ? (
          <ul className="grid gap-0.5">
            {ENV_NAV.map((item) => {
              const href = `${base}${item.key}`;
              const active = item.key === "" ? pathname === base : pathname.startsWith(href);
              return (
                <li key={item.key}>
                  <NavLink href={href} active={active} onNavigate={() => setOpen(false)}>
                    <item.icon className="size-4" />
                    {item.label}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        ) : (
          <ul className="grid gap-0.5">
            <li>
              <NavLink
                href="/projects"
                active={pathname === "/projects"}
                onNavigate={() => setOpen(false)}
              >
                <FolderKanban className="size-4" />
                Projects
              </NavLink>
            </li>
          </ul>
        )}
      </nav>

      <div className="grid gap-0.5 border-t border-sidebar-border p-2 text-sm">
        <NavLink href="/roles" active={pathname === "/roles"} onNavigate={() => setOpen(false)}>
          <Shield className="size-4" />
          Cluster roles
        </NavLink>
        {backupsUrl && (
          <a
            href={backupsUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <Database className="size-4" />
            Backups
          </a>
        )}
        <div className="px-1 pt-1">
          <SignOutButton />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-60 shrink-0 border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:block">
        {content}
      </aside>
      <div className="flex h-12 items-center gap-3 border-b bg-sidebar px-4 md:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <Link href="/projects" className="font-semibold">
          db-web
        </Link>
        {current && (
          <span className="ml-auto flex items-center gap-2 font-mono text-xs">
            {current.database}
            <EnvBadge database={current.database} />
          </span>
        )}
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="w-64 bg-sidebar text-sidebar-foreground">{content}</div>
          <button
            type="button"
            className="flex-1 bg-black/60"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
          />
        </div>
      )}
    </>
  );
}

function NavLink({
  href,
  active,
  onNavigate,
  children,
}: {
  href: string;
  active: boolean;
  onNavigate: () => void;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-sidebar-accent",
        active ? "bg-sidebar-accent text-primary" : "text-sidebar-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function ProjectSwitcher({ projects, current }: Pick<SidebarProps, "projects" | "current">) {
  const [expanded, setExpanded] = useState(false);
  const project = projects.find((p) => p.name === current?.project);

  return (
    <div className="grid gap-1">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-background px-2 py-1.5 text-left text-sm"
        aria-expanded={expanded}
      >
        <FolderKanban className="size-4 text-muted-foreground" />
        <span className="truncate font-medium">{current?.project ?? "Choose a project"}</span>
        <ChevronDown className="ml-auto size-4 text-muted-foreground" />
      </button>
      {expanded && (
        <ul className="max-h-64 overflow-y-auto rounded-md border border-sidebar-border bg-popover p-1 text-sm">
          {projects.map((p) => (
            <li key={p.name}>
              <Link
                href={`/projects/${p.name}`}
                onClick={() => setExpanded(false)}
                className={cn(
                  "block rounded px-2 py-1 hover:bg-sidebar-accent",
                  p.name === current?.project && "text-primary",
                )}
              >
                {p.name}
              </Link>
            </li>
          ))}
          {projects.length === 0 && (
            <li className="px-2 py-1 text-muted-foreground">No projects</li>
          )}
        </ul>
      )}
      {project && current && (
        <div className="flex flex-wrap gap-1 pt-1">
          {project.envs.map((e) => (
            <Link
              key={e.database}
              href={`/projects/${project.name}/${e.env}`}
              className={cn(
                "rounded-md border px-2 py-0.5 font-mono text-xs",
                e.env === current.env
                  ? "border-primary/50 bg-primary/10 text-primary"
                  : "border-sidebar-border text-sidebar-foreground hover:bg-sidebar-accent",
              )}
            >
              {e.env}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
