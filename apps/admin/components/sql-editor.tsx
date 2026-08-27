"use client";

import { PostgreSQL, sql as sqlLang } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import {
  clearHistoryAction,
  type ExplainResponse,
  executeQuery,
  explainQuery,
  type QueryResponse,
} from "@/app/actions/query";
import { deleteSavedQueryAction, saveQueryAction } from "@/app/actions/saved-queries";
import { FormError } from "@/components/form-error";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Kbd, KbdGroup } from "@/components/ui/kbd";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { HistoryEntry } from "@/lib/query-history";
import type { SavedQuery } from "@/lib/saved-queries";
import { cn } from "@/lib/utils";
import { ResultsGrid } from "./results-grid";

const DEFAULT_LIMIT = 1000;

export function SqlEditor({
  database,
  saved,
  history,
  initial = "",
}: {
  database: string;
  saved: SavedQuery[];
  history: HistoryEntry[];
  initial?: string;
}) {
  const router = useRouter();
  const [text, setText] = useState(initial);
  const [explain, setExplain] = useState<ExplainResponse | null>(null);
  const [confirmAnalyze, setConfirmAnalyze] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [response, setResponse] = useState<QueryResponse | null>(null);
  const [limit, setLimit] = useState(DEFAULT_LIMIT);
  const [pending, start] = useTransition();
  const ref = useRef<ReactCodeMirrorRef>(null);

  function run(nextLimit = DEFAULT_LIMIT) {
    const view = ref.current?.view;
    const sel = view?.state.selection.main;
    const selected = sel && !sel.empty ? view.state.sliceDoc(sel.from, sel.to) : "";
    const query = selected || text;
    setLimit(nextLimit);
    setExplain(null);
    start(async () => {
      setResponse(await executeQuery(database, query, nextLimit));
      router.refresh();
    });
  }

  function currentSql() {
    const view = ref.current?.view;
    const sel = view?.state.selection.main;
    const selected = sel && !sel.empty ? view.state.sliceDoc(sel.from, sel.to) : "";
    return selected || text;
  }

  function runExplain(analyze: boolean) {
    setConfirmAnalyze(false);
    setResponse(null);
    start(async () => setExplain(await explainQuery(database, currentSql(), analyze)));
  }

  function save() {
    setSaveError(null);
    start(async () => {
      const res = await saveQueryAction(database, saveName, text);
      if (!res.ok) setSaveError(res.error);
      else {
        setSaveName("");
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
      <div className="grid gap-4">
        <CodeMirror
          ref={ref}
          value={text}
          height="220px"
          theme={oneDark}
          extensions={[sqlLang({ dialect: PostgreSQL })]}
          onChange={setText}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              run();
            }
          }}
          basicSetup={{ lineNumbers: true, foldGutter: false }}
        />
        <div className="flex items-center gap-3">
          <Button onClick={() => run()} disabled={pending}>
            Run
          </Button>
          <Button variant="outline" size="sm" onClick={() => runExplain(false)} disabled={pending}>
            Explain
          </Button>
          {confirmAnalyze ? (
            <span className="flex items-center gap-1 text-xs">
              <span className="text-muted-foreground">
                Executes the statement, then rolls back.
              </span>
              <Button
                variant="destructive"
                size="xs"
                onClick={() => runExplain(true)}
                disabled={pending}
              >
                Analyze
              </Button>
              <Button variant="ghost" size="xs" onClick={() => setConfirmAnalyze(false)}>
                Cancel
              </Button>
            </span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmAnalyze(true)}
              disabled={pending}
            >
              Explain analyze
            </Button>
          )}
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>Enter</Kbd>
            </KbdGroup>
            runs the selection if there is one. Rows capped at {limit}.
          </span>
        </div>
        {explain && !explain.ok && <FormError error={explain.error} mono />}
        {explain?.ok && (
          <div className="grid gap-1">
            <div className="text-xs text-muted-foreground">plan in {explain.durationMs} ms</div>
            <pre className="overflow-x-auto rounded-lg border bg-card p-3 font-mono text-xs leading-relaxed">
              {explain.plan}
            </pre>
          </div>
        )}
        {response && !response.ok && <FormError error={response.error} mono />}
        {response?.ok && (
          <>
            <div className="text-xs text-muted-foreground">
              {response.result.command
                ? `${response.result.command}${response.result.rowCount !== null ? ` ${response.result.rowCount}` : ""}`
                : `${response.result.rows.length} row${response.result.rows.length === 1 ? "" : "s"}`}
              {" in "}
              {response.result.durationMs} ms
              {response.result.truncated && (
                <>
                  {" (capped) "}
                  <Button variant="link" size="sm" onClick={() => run(limit * 10)}>
                    show up to {limit * 10}
                  </Button>
                </>
              )}
            </div>
            {response.result.columns.length > 0 && (
              <ResultsGrid columns={response.result.columns} rows={response.result.rows} />
            )}
          </>
        )}
      </div>
      <aside className="text-sm">
        <Tabs defaultValue="saved">
          <TabsList variant="line" className="w-full">
            <TabsTrigger value="saved">Saved ({saved.length})</TabsTrigger>
            <TabsTrigger value="history">History ({history.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="history">
            <ul className="grid gap-1">
              {history.map((h) => (
                <li key={h.id}>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1 text-left hover:bg-muted"
                    title={h.sql}
                    onClick={() => setText(h.sql)}
                  >
                    <div className="truncate font-mono text-xs">{h.sql}</div>
                    <div
                      className={cn(
                        "text-[10px]",
                        h.error ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {h.ran_at.slice(5, 16).replace("T", " ")} · {h.duration_ms} ms
                      {h.error ? " · failed" : h.row_count !== null ? ` · ${h.row_count} rows` : ""}
                    </div>
                  </button>
                </li>
              ))}
              {history.length === 0 && (
                <li className="px-2 text-xs text-muted-foreground">Nothing run yet.</li>
              )}
              {history.length > 0 && (
                <li>
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
          </TabsContent>
          <TabsContent value="saved" className="grid gap-3">
            <div className="flex gap-1">
              <Input
                placeholder="save as…"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveName.trim() && save()}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={!saveName.trim() || !text.trim() || pending}
                onClick={save}
              >
                Save
              </Button>
            </div>
            {saveError && <p className="text-xs text-destructive">{saveError}</p>}
            <ul className="grid gap-1">
              {saved.map((q) => (
                <li key={q.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    className="flex-1 truncate rounded px-2 py-1 text-left font-mono text-xs hover:bg-muted"
                    title={q.sql}
                    onClick={() => {
                      setText(q.sql);
                      setSaveName(q.name);
                    }}
                  >
                    {q.name}
                  </button>
                  <button
                    type="button"
                    className="px-1 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive"
                    title={`Delete ${q.name}`}
                    onClick={() =>
                      start(async () => {
                        await deleteSavedQueryAction(database, q.id);
                        router.refresh();
                      })
                    }
                  >
                    ×
                  </button>
                </li>
              ))}
              {saved.length === 0 && (
                <li className="px-2 text-xs text-muted-foreground">No saved queries.</li>
              )}
            </ul>
          </TabsContent>
        </Tabs>
      </aside>
    </div>
  );
}
