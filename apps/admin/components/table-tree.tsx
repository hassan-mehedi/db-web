"use client";

import { ChevronRight, Search, Table2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
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
  const [filter, setFilter] = useState("");
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const q = filter.trim().toLowerCase();

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
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter tables"
          className="h-8 pl-8 text-sm"
        />
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
                              <Link href={tablePath(database, schema, t.relname)}>
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
