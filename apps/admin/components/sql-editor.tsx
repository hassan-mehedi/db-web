"use client";

import { PostgreSQL, sql as sqlLang } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import CodeMirror, { type ReactCodeMirrorRef } from "@uiw/react-codemirror";
import { useRef, useState, useTransition } from "react";
import { executeQuery, type QueryResponse } from "@/app/db/[database]/query/actions";
import { Button } from "@/components/ui/button";
import { ResultsGrid } from "./results-grid";

const DEFAULT_LIMIT = 1000;

export function SqlEditor({ database }: { database: string }) {
  const [text, setText] = useState("");
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

  return (
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
  );
}
