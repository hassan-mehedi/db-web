"use client";

import { ChevronRight, Search, Table2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { lastTab } from "@/lib/last-tab";
import { tablePath } from "@/lib/routes";

export interface TreeSchema {
  schema: string;
  tables: { relname: string; est_rows: string; size: string }[];
}

export function TableTree({
  database,
  schemas,
  selected,
}: {
  database: string;
  schemas: TreeSchema[];
  selected?: { schema: string; table: string } | undefined;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState("");
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const q = filter.trim().toLowerCase();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      inputRef.current?.focus();
      inputRef.current?.select();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function toggle(schema: string, open: boolean) {
    setClosed((prev) => {
      const next = new Set(prev);
      if (open) next.delete(schema);
      else next.add(schema);
      return next;
    });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative border-b p-2">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setFilter("");
              e.currentTarget.blur();
            }
          }}
          placeholder="Filter tables"
          className="h-8 pr-8 pl-8 text-sm"
        />
        <Kbd className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2">/</Kbd>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <SidebarMenu className="p-2">
          {schemas.map(({ schema, tables }) => {
            const visible = q ? tables.filter((t) => t.relname.toLowerCase().includes(q)) : tables;
            if (q && visible.length === 0) return null;
            const isOpen = q ? true : !closed.has(schema);
            return (
              <Collapsible
                key={schema}
                open={isOpen}
                onOpenChange={(open) => toggle(schema, open)}
                className="group/schema"
                asChild
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton size="sm" className="font-mono text-muted-foreground">
                      <ChevronRight className="transition-transform group-data-[state=open]/schema:rotate-90" />
                      <span>{schema}</span>
                      <span className="ml-auto text-xs">{tables.length}</span>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub className="mr-0 pr-0">
                      {visible.map((t) => {
                        const active = selected?.schema === schema && selected.table === t.relname;
                        return (
                          <SidebarMenuSubItem key={t.relname}>
                            <SidebarMenuSubButton asChild size="sm" isActive={active}>
                              <Link
                                href={tablePath(database, schema, t.relname)}
                                onClick={(e) => {
                                  if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                                  const path = tablePath(database, schema, t.relname);
                                  const tab = lastTab(path);
                                  if (!tab) return;
                                  e.preventDefault();
                                  router.push(`${path}?tab=${tab}`);
                                }}
                              >
                                <Table2 className="text-muted-foreground" />
                                <span className="font-mono">{t.relname}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        );
                      })}
                      {visible.length === 0 && (
                        <SidebarMenuSubItem className="px-2 py-1 text-xs text-muted-foreground">
                          empty
                        </SidebarMenuSubItem>
                      )}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            );
          })}
        </SidebarMenu>
      </ScrollArea>
    </div>
  );
}
