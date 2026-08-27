import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { logRender } from "@/lib/timing";

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
  const timing = logRender(`/${crumbs.map((c) => c.label).join("/")}`);
  return (
    <>
      <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 text-sm">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-1 h-4! self-center" />
        <Breadcrumb className="min-w-0 overflow-hidden">
          <BreadcrumbList className="flex-nowrap">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/projects">Projects</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {crumbs.map((c, i) => (
              <Fragment key={`${c.label}-${c.href ?? ""}`}>
                <BreadcrumbSeparator />
                <BreadcrumbItem className="min-w-0 font-mono">
                  {c.href && i < crumbs.length - 1 ? (
                    <BreadcrumbLink asChild className="truncate">
                      <Link href={c.href}>{c.label}</Link>
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="truncate">{c.label}</BreadcrumbPage>
                  )}
                </BreadcrumbItem>
              </Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
        <div className="ml-auto flex items-center gap-3">
          {actions}
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="font-mono text-[10px] text-muted-foreground/60">
                {timing.total} ms
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="font-mono text-xs">
              {timing.entries.length === 0
                ? "no queries"
                : timing.entries.map((e) => (
                    <div key={e.label}>
                      {e.label} {e.ms} ms
                    </div>
                  ))}
            </TooltipContent>
          </Tooltip>
        </div>
      </header>
      <div className={wide ? "flex min-h-0 flex-1 flex-col" : "mx-auto w-full max-w-6xl p-6"}>
        {children}
      </div>
    </>
  );
}
