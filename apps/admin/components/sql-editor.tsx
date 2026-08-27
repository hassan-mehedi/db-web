"use client";

import { PostgreSQL, sql as sqlLang } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { executeQuery, type QueryResponse } from "@/app/actions/query";
import { deleteSavedQueryAction, saveQueryAction } from "@/app/actions/saved-queries";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SavedQuery } from "@/lib/saved-queries";
import { ResultsGrid } from "./results-grid";

const DEFAULT_LIMIT = 1000;

export function SqlEditor({ database, saved }: { database: string; saved: SavedQuery[] }) {
  const router = useRouter();
  const [text, setText] = useState("");
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
    start(async () => setResponse(await executeQuery(database, query, nextLimit)));
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
          <span className="text-xs text-muted-foreground">
            Ctrl/Cmd+Enter. Runs the selection if there is one. Rows capped at {limit}.
          </span>
        </div>
        {response && !response.ok && (
          <pre className="whitespace-pre-wrap rounded border border-destructive/40 bg-destructive/10 p-3 font-mono text-xs text-destructive">
            {response.error}
          </pre>
        )}
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
      <aside className="grid content-start gap-3 text-sm">
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
      </aside>
    </div>
  );
}
