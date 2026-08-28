"use client";

import { PostgreSQL, sql as sqlLang } from "@codemirror/lang-sql";
import { Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import {
  BookmarkPlus,
  ChevronDown,
  Clock,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  Play,
  Save,
  Square,
  Trash2,
  WandSparkles,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  type FormEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { format } from "sql-formatter";
import {
  clearHistoryAction,
  type ExplainResponse,
  executeQuery,
  explainQuery,
  type QueryResponse,
} from "@/app/actions/query";
import { deleteSavedQueryAction, saveQueryAction } from "@/app/actions/saved-queries";
import { FormError } from "@/components/form-error";
import { PlanTree } from "@/components/plan-tree";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { editorTheme } from "@/lib/editor-theme";
import type { CompletionSchema } from "@/lib/queries";
import type { HistoryEntry } from "@/lib/query-history";
import type { StatementResult } from "@/lib/run-query";
import type { SavedQuery } from "@/lib/saved-queries";
import { splitStatements, statementAt } from "@/lib/sql-split";
import { cn } from "@/lib/utils";
import { ResultsGrid } from "./results-grid";

const DEFAULT_LIMIT = 1000;

export function SqlEditor({
  database,
  saved,
  history,
  completion,
  initial = "",
}: {
  database: string;
  saved: SavedQuery[];
  history: HistoryEntry[];
  completion: CompletionSchema;
  initial?: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [explain, setExplain] = useState<ExplainResponse | null>(null);
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [runId, setRunId] = useState(0);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [pane, setPane] = useState<"results" | "plan">("results");
  const [resultTab, setResultTab] = useState(0);
  const [token, setToken] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [sideOpen, setSideOpen] = useState(true);
  const [saveName, setSaveName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savingOpen, setSavingOpen] = useState(false);
  const [pending, start] = useTransition();
  const ref = useRef<ReactCodeMirrorRef>(null);
  const runRef = useRef<(scope: "cursor" | "all") => void>(() => {});

  const extensions = useMemo(
    () => [
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Enter",
            run: () => {
              runRef.current("cursor");
              return true;
            },
          },
          {
            key: "Mod-Shift-Enter",
            run: () => {
              runRef.current("all");
              return true;
            },
          },
        ]),
      ),
      sqlLang({
        dialect: PostgreSQL,
        schema: completion,
        defaultSchema: "public",
        upperCaseKeywords: true,
      }),
      EditorView.lineWrapping,
      editorTheme,
    ],
    [completion],
  );

  function currentSql(scope: "cursor" | "all" = "cursor") {
    const view = ref.current?.view;
    const sel = view?.state.selection.main;
    const selected = sel && !sel.empty ? view.state.sliceDoc(sel.from, sel.to) : "";
    if (selected) return selected;
    if (scope === "cursor" && sel && splitStatements(text).length > 1) {
      return statementAt(text, sel.head)?.text ?? text;
    }
    return text;
  }

  const statementCount = splitStatements(text).length;

  function run(nextLimit = DEFAULT_LIMIT, scope: "cursor" | "all" = "cursor") {
    const query = currentSql(scope);
    const id = crypto.randomUUID();
    setLimit(nextLimit);
    setPane("results");
    setResultTab(0);
    setCancelError(null);
    setToken(id);
    start(async () => {
      const res = await executeQuery(database, query, nextLimit, id);
      setToken(null);
      setResponse(res);
      if (res.ok) setResultTab(Math.max(0, res.results.length - 1));
      setRunId((n) => n + 1);
      router.refresh();
    });
  }

  useEffect(() => {
    runRef.current = (scope) => run(DEFAULT_LIMIT, scope);
  });

  async function cancel() {
    if (!token) return;
    const res = await fetch("/api/query/cancel", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const body = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
    if (!body.ok) setCancelError(body.error ?? `cancel failed (${res.status})`);
  }

  const current: StatementResult | null = response?.ok
    ? (response.results[resultTab] ?? null)
    : null;
  const result = current?.ok ? current.outcome : null;

  function runExplain(analyze: boolean) {
    setPane("plan");
    start(async () => setExplain(await explainQuery(database, currentSql(), analyze)));
  }

  function formatSql() {
    try {
      setText(format(text, { language: "postgresql", keywordCase: "upper" }));
    } catch {
      /* leave the text as typed when it does not parse */
    }
  }

  function save(e: FormEvent) {
    e.preventDefault();
    setSaveError(null);
    start(async () => {
      const res = await saveQueryAction(database, saveName, text);
      if (!res.ok) setSaveError(res.error);
      else {
        setSaveName("");
        setSavingOpen(false);
        router.refresh();
      }
    });
  }

  const status = result
    ? result.command
      ? `${result.command}${result.rowCount !== null ? ` · ${result.rowCount} affected` : ""} · ${result.durationMs} ms`
      : `${result.rows.length} row${result.rows.length === 1 ? "" : "s"}${result.truncated ? ` (capped at ${limit})` : ""} · ${result.durationMs} ms`
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b px-3">
        {pending && token ? (
          <Button size="sm" variant="destructive" onClick={cancel}>
            <Square />
            Cancel
          </Button>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" onClick={() => run()} disabled={pending}>
                {pending ? <Loader2 className="animate-spin" /> : <Play />}
                Run
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex items-center gap-2">
              Runs the selection, else the statement at the cursor
              <KbdGroup>
                <Kbd>⌘</Kbd>
                <Kbd>↵</Kbd>
              </KbdGroup>
            </TooltipContent>
          </Tooltip>
        )}
        {statementCount > 1 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={() => run(DEFAULT_LIMIT, "all")}
                disabled={pending}
              >
                Run all ({statementCount})
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="flex items-center gap-2">
              Runs every statement in order, stops at the first error
              <KbdGroup>
                <Kbd>⌘</Kbd>
                <Kbd>⇧</Kbd>
                <Kbd>↵</Kbd>
              </KbdGroup>
            </TooltipContent>
          </Tooltip>
        )}
        {cancelError && <span className="text-xs text-destructive">{cancelError}</span>}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" disabled={pending}>
              Explain
              <ChevronDown />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => runExplain(false)}>Explain</DropdownMenuItem>
            <DropdownMenuItem onClick={() => runExplain(true)}>
              Explain analyze
              <span className="ml-auto text-xs text-muted-foreground">runs, then rolls back</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button size="sm" variant="ghost" onClick={formatSql} disabled={!text.trim()}>
          <WandSparkles />
          Format
        </Button>
        {savingOpen ? (
          <form onSubmit={save} className="flex items-center gap-1">
            <Input
              autoFocus
              placeholder="name"
              className="h-7 w-40"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
            />
            <Button
              size="sm"
              type="submit"
              variant="outline"
              disabled={!saveName.trim() || pending}
            >
              <Save />
              Save
            </Button>
            <Button
              size="icon-sm"
              type="button"
              variant="ghost"
              onClick={() => setSavingOpen(false)}
              aria-label="Cancel save"
            >
              <X />
            </Button>
          </form>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSavingOpen(true)}
            disabled={!text.trim()}
          >
            <BookmarkPlus />
            Save
          </Button>
        )}
        {saveError && <span className="text-xs text-destructive">{saveError}</span>}
        <Button
          size="icon-sm"
          variant="ghost"
          className="ml-auto"
          onClick={() => setSideOpen((v) => !v)}
          aria-label={sideOpen ? "Hide saved and history" : "Show saved and history"}
        >
          {sideOpen ? <PanelRightClose /> : <PanelRightOpen />}
        </Button>
      </div>

      <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
        <ResizablePanel defaultSize="78" minSize="40" className="min-w-0">
          <ResizablePanelGroup orientation="vertical">
            <ResizablePanel defaultSize="45" minSize="15" className="min-w-0">
              <CodeMirror
                ref={ref}
                value={text}
                height="100%"
                className="h-full text-[13px] [&_.cm-editor]:h-full"
                theme="none"
                extensions={extensions}
                onChange={setText}
                basicSetup={{ lineNumbers: true, foldGutter: false, autocompletion: true }}
                placeholder="select * from ..."
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize="55" minSize="15" className="flex flex-col">
              <Tabs
                value={pane}
                onValueChange={(v) => setPane(v as "results" | "plan")}
                className="flex min-h-0 flex-1 flex-col gap-0"
              >
                <div className="flex h-9 shrink-0 items-center border-b px-3">
                  <TabsList variant="line" className="h-9">
                    <TabsTrigger value="results">Results</TabsTrigger>
                    <TabsTrigger value="plan">Plan</TabsTrigger>
                  </TabsList>
                  <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                    {result?.source && (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        <Pencil />
                        {result.source.schema}.{result.source.table}
                      </Badge>
                    )}
                    {status}
                    {result?.truncated && (
                      <Button variant="link" size="xs" onClick={() => run(limit * 10)}>
                        show up to {limit * 10}
                      </Button>
                    )}
                  </div>
                </div>
                <TabsContent value="results" className="flex min-h-0 flex-1 flex-col">
                  {!response && <Empty>Run a query to see results here.</Empty>}
                  {response && !response.ok && (
                    <div className="p-3">
                      <FormError error={response.error} mono />
                    </div>
                  )}
                  {response?.ok && response.results.length > 1 && (
                    <div className="flex shrink-0 flex-wrap gap-1 border-b px-2 py-1">
                      {response.results.map((r, i) => (
                        <button
                          type="button"
                          // biome-ignore lint/suspicious/noArrayIndexKey: statements are positional
                          key={i}
                          onClick={() => setResultTab(i)}
                          title={r.sql}
                          className={cn(
                            "rounded px-2 py-0.5 font-mono text-[11px]",
                            i === resultTab
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:bg-muted",
                            !r.ok && "text-destructive",
                          )}
                        >
                          {i + 1}. {statementLabel(r)}
                        </button>
                      ))}
                    </div>
                  )}
                  {current && !current.ok && (
                    <div className="p-3">
                      <FormError error={current.error} mono />
                    </div>
                  )}
                  {result && result.columns.length > 0 && (
                    <ResultsGrid
                      key={`${runId}:${resultTab}`}
                      database={database}
                      columns={result.columns}
                      rows={result.rows}
                      source={result.source}
                      links={result.links}
                    />
                  )}
                  {result && result.columns.length === 0 && <Empty>{status}</Empty>}
                </TabsContent>
                <TabsContent value="plan" className="min-h-0 flex-1">
                  {!explain && <Empty>Explain a statement to see its plan here.</Empty>}
                  {explain && !explain.ok && (
                    <div className="p-3">
                      <FormError error={explain.error} mono />
                    </div>
                  )}
                  {explain?.ok && <PlanTree plan={explain.plan} durationMs={explain.durationMs} />}
                </TabsContent>
              </Tabs>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
        {sideOpen && (
          <>
            <ResizableHandle />
            <ResizablePanel defaultSize="22" minSize="15" maxSize="40" className="min-w-0">
              <aside className="flex h-full flex-col text-sm">
                <Tabs defaultValue="saved" className="flex min-h-0 flex-1 flex-col gap-0">
                  <TabsList variant="line" className="h-9 w-full shrink-0 border-b px-2">
                    <TabsTrigger value="saved">Saved ({saved.length})</TabsTrigger>
                    <TabsTrigger value="history">History ({history.length})</TabsTrigger>
                  </TabsList>
                  <TabsContent value="saved" className="min-h-0 flex-1">
                    <ScrollArea className="h-full">
                      <ul className="grid gap-0.5 p-2">
                        {saved.map((q) => (
                          <li key={q.id} className="group flex items-center gap-1">
                            <button
                              type="button"
                              className="flex-1 truncate rounded px-2 py-1.5 text-left font-mono text-xs hover:bg-muted"
                              title={q.sql}
                              onClick={() => {
                                setText(q.sql);
                                setSaveName(q.name);
                              }}
                            >
                              {q.name}
                            </button>
                            <Button
                              size="icon-xs"
                              variant="ghost"
                              className="opacity-0 group-hover:opacity-100"
                              aria-label={`Delete ${q.name}`}
                              onClick={() =>
                                start(async () => {
                                  await deleteSavedQueryAction(database, q.id);
                                  router.refresh();
                                })
                              }
                            >
                              <Trash2 />
                            </Button>
                          </li>
                        ))}
                        {saved.length === 0 && (
                          <li className="px-2 py-1 text-xs text-muted-foreground">
                            Nothing saved. Use Save in the toolbar.
                          </li>
                        )}
                      </ul>
                    </ScrollArea>
                  </TabsContent>
                  <TabsContent value="history" className="min-h-0 flex-1">
                    <ScrollArea className="h-full">
                      <ul className="grid gap-0.5 p-2">
                        {history.map((h) => (
                          <li key={h.id}>
                            <button
                              type="button"
                              className="w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                              title={h.sql}
                              onClick={() => setText(h.sql)}
                            >
                              <div className="truncate font-mono text-xs">{h.sql}</div>
                              <div
                                className={cn(
                                  "flex items-center gap-1 text-[10px]",
                                  h.error ? "text-destructive" : "text-muted-foreground",
                                )}
                              >
                                <Clock className="size-3" />
                                {h.ran_at.slice(5, 16).replace("T", " ")} · {h.duration_ms} ms
                                {h.error
                                  ? " · failed"
                                  : h.row_count !== null
                                    ? ` · ${h.row_count} rows`
                                    : ""}
                              </div>
                            </button>
                          </li>
                        ))}
                        {history.length === 0 && (
                          <li className="px-2 py-1 text-xs text-muted-foreground">
                            Nothing run yet.
                          </li>
                        )}
                        {history.length > 0 && (
                          <li className="pt-1">
                            <Button
                              variant="ghost"
                              size="xs"
                              onClick={() =>
                                start(async () => {
                                  await clearHistoryAction(database);
                                  router.refresh();
                                })
                              }
                            >
                              Clear history
                            </Button>
                          </li>
                        )}
                      </ul>
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </aside>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}

function statementLabel(r: StatementResult): string {
  if (!r.ok) return "error";
  const o = r.outcome;
  if (o.command) return `${o.command}${o.rowCount !== null ? ` ${o.rowCount}` : ""}`;
  return `${o.rows.length} row${o.rows.length === 1 ? "" : "s"}`;
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}
