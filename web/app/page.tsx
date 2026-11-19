"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

const POLL_MS = 2500;
const statuses = new Map([
  ["pending", "Pending"],
  ["running", "Running"],
  ["awaiting_approval", "Awaiting approval"],
  ["done", "Done"],
  ["failed", "Failed"],
]);

type AgentRun = {
  id: string | number;
  agent: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
};

type Snapshot = { prompt: string; runs: AgentRun[] };

function formatTime(timestamp: string) {
  return new Date(timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
}

export default function Home() {
  const [access, setAccess] = useState<"checking" | "locked" | "open">("checking");
  const [code, setCode] = useState("");
  const [query, setQuery] = useState("");
  const [queryId, setQueryId] = useState("");
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [accessError, setAccessError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [pollError, setPollError] = useState("");
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const submission = useRef<{ queryId: string; prompt: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function restoreSession() {
      try {
        const response = await fetch("/api/queries", { signal: controller.signal });
        if (response.ok) {
          setQueryId(new URLSearchParams(window.location.search).get("queryId") ?? "");
          setAccess("open");
          return;
        }
        if (response.status !== 401) {
          const result = await response.json();
          setAccessError(result.error);
        }
      } catch {
        if (controller.signal.aborted) return;
        setAccessError("Could not connect. Try entering the team access code.");
      }
      if (!controller.signal.aborted) setAccess("locked");
    }
    void restoreSession();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!queryId || access !== "open") return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;

    async function refresh() {
      const params = new URLSearchParams({ queryId });
      try {
        const response = await fetch(`/api/queries?${params}`, { signal: controller.signal });
        const result = await response.json();
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          setSnapshot(undefined);
          setAccess("locked");
          setAccessError("Team access expired. Enter the current code to continue.");
          return;
        }
        if (!response.ok) {
          setPollError(result.error ?? "Could not refresh run status.");
          if (response.status === 400 || response.status === 404) return;
        } else {
          setSnapshot(result);
          setPollError("");
        }
      } catch {
        if (controller.signal.aborted) return;
        setPollError("Could not refresh run status. Retrying automatically.");
      }
      timer = setTimeout(refresh, POLL_MS);
    }

    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [access, queryId]);

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isUnlocking) return;
    setIsUnlocking(true);
    setAccessError("");
    try {
      const response = await fetch("/api/queries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not unlock the console.");
      setQueryId(new URLSearchParams(window.location.search).get("queryId") ?? "");
      setAccess("open");
      setCode("");
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : "Could not unlock the console.");
    } finally {
      setIsUnlocking(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = query.trim();
    if (isSubmitting || !prompt) return;
    setIsSubmitting(true);
    setSubmitError("");
    try {
      // Reuse the ID if a save timed out and the user tries the same prompt again.
      if (submission.current?.prompt !== prompt) {
        submission.current = { prompt, queryId: crypto.randomUUID() };
      }
      const response = await fetch("/api/queries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submission.current),
      });
      const result = await response.json();
      if (response.status === 401) {
        setSnapshot(undefined);
        setAccess("locked");
        setAccessError("Team access expired. Enter the current code to continue.");
        return;
      }
      if (!response.ok) throw new Error(result.error ?? "The query could not be saved.");

      const link = new URL(window.location.href);
      link.searchParams.set("queryId", result.queryId);
      window.history.replaceState(null, "", link);
      setSnapshot(undefined);
      setPollError("");
      setLinkCopied(false);
      setQueryId(result.queryId);
      setQuery("");
      submission.current = null;
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Could not confirm the save. Try the same prompt again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function copyRunLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
    } catch {
      setLinkCopied(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-inner">
          <span className="brand"><span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>Purdue Pioneers</span>
          <span className="topbar-caption">Agentic Workflow Mini Project</span>
        </div>
      </header>
      <main className="shell main">
        <div className="intro">
          <h1>Workflow Console</h1>
          <p>Submit a research query and follow its progress through the team’s agents.</p>
        </div>

        <div className="dashboard">
          <section className="panel" aria-labelledby="query-title">
            <div className="panel-heading">
              <h2 id="query-title">New query</h2>
            </div>
            <div className="panel-body">
              {access === "open" ? (
                <form onSubmit={submit}>
                  <label htmlFor="prompt">What should the agents research?</label>
                  <textarea
                    id="prompt"
                    placeholder="For example, compare public EV charging adoption in three Midwest cities."
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    maxLength={4000}
                    disabled={isSubmitting}
                    required
                  />
                  <div className="form-actions">
                    <span className="count">{query.length.toLocaleString()} / 4,000</span>
                    <button type="submit" disabled={isSubmitting || !query.trim()}>
                      {isSubmitting ? "Submitting…" : "Submit query"}<span aria-hidden="true">↗</span>
                    </button>
                  </div>
                  {submitError && <p className="error" role="alert">{submitError}</p>}
                </form>
              ) : access === "checking" ? (
                <p role="status" className="muted">Checking team access…</p>
              ) : (
                <form onSubmit={unlock}>
                  <label htmlFor="access-code">Team access code</label>
                  <input
                    id="access-code"
                    type="password"
                    value={code}
                    onChange={(event) => setCode(event.target.value)}
                    autoComplete="off"
                    required
                    disabled={isUnlocking}
                  />
                  <div className="form-actions unlock-actions">
                    <button type="submit" disabled={isUnlocking || !code.trim()}>
                      {isUnlocking ? "Unlocking…" : "Unlock console"}<span aria-hidden="true">↗</span>
                    </button>
                  </div>
                  {accessError && <p className="error" role="alert">{accessError}</p>}
                </form>
              )}
            </div>
          </section>

          <section className="panel status-panel" aria-labelledby="status-title">
            <div className="panel-heading">
              <h2 id="status-title">Run status</h2>
              {access === "open" && queryId && !pollError && snapshot && (
                <span className="live"><span aria-hidden="true" />Live</span>
              )}
            </div>
            {access === "open" && queryId ? (
              <div className="panel-body">
                <div className="run-header">
                  <code title={queryId}>Run {queryId.slice(0, 8)}</code>
                  {snapshot && (
                    <button type="button" className="text-button" onClick={copyRunLink}>
                      {linkCopied ? "Link copied" : "Copy run link"}
                    </button>
                  )}
                </div>
                {snapshot && <p className="submitted-prompt">{snapshot.prompt}</p>}
                {pollError && <p className="error" role="alert">{pollError}</p>}
                <div aria-live="polite">
                  {snapshot?.runs.length ? (
                    <ul className="run-list">
                      {snapshot.runs.map((run) => (
                        <li key={run.id}>
                          <div className="agent-name">
                            <strong>{run.agent}</strong>
                            {run.ended_at ? <small>Ended at {formatTime(run.ended_at)}</small> :
                              run.started_at && <small>Started at {formatTime(run.started_at)}</small>}
                          </div>
                          <span className="run-state" data-state={run.status}>{statuses.get(run.status) ?? run.status}</span>
                        </li>
                      ))}
                    </ul>
                  ) : snapshot ? (
                    <p className="waiting">Query saved. Waiting for the orchestrator to log the first agent run.</p>
                  ) : !pollError && <p className="waiting">Loading run status…</p>}
                </div>
              </div>
            ) : (
              <div className="empty">
                <span className="empty-icon" aria-hidden="true"><i /><i /><i /></span>
                <strong>No query selected</strong>
                <span>Submit a query to see agent activity here.</span>
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}
