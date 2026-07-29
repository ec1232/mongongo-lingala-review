"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  aggregateReviewResults,
  DOMAIN_LABELS,
  DOMAIN_ORDER,
} from "./aggregate.mjs";

type ReviewStatus =
  | "approved_as_written"
  | "approved_with_correction"
  | "needs_discussion"
  | "rejected";

type EvalLine = {
  id: string;
  domain: string;
  difficulty: string;
  feature: string;
  text: string;
  intent_en: string;
};

type EvalSet = {
  set_id: string;
  lines: EvalLine[];
};

type ReviewResponse = {
  status: ReviewStatus;
  corrected_text: string;
  note: string;
};

type ResultSubmission = {
  id: string;
  reviewer: string;
  submitted_at: string;
  reviews: Record<string, ReviewResponse>;
};

type ResultsResponse = {
  ok: boolean;
  generated_at: string;
  set_id: string;
  excluded_test_submissions: number;
  submissions: ResultSubmission[];
};

type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

type Filter = "all" | "accepted" | "conflict" | "unreviewed";

const SUPABASE_URL = "https://giialrhkoqghytkizrgv.supabase.co";
const PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpaWFscmhrb3FnaHl0a2l6cmd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY0MjAxMjksImV4cCI6MjA1MTk5NjEyOX0.DV54cGGaUJqQeS3vZSI0dGAp9e2YjZwdX2vFetj2ukg";
const RESULTS_ENDPOINT = `${SUPABASE_URL}/functions/v1/get-lingala-review-results`;
const AUTH_ENDPOINT = `${SUPABASE_URL}/auth/v1/token`;
const DASHBOARD_EMAIL = "contact@intellingo.app";
const ACCESS_TOKEN_KEY = "lingala-results:access-token";
const REFRESH_TOKEN_KEY = "lingala-results:refresh-token";
const EVALUATOR_LINK = "https://evaluation-lingala.onrender.com";

const STATUS_COPY = {
  approved_as_written: "Natural",
  approved_with_correction: "Corrected",
  needs_discussion: "Unsure",
  rejected: "Do not use",
};

const REASON_COPY: Record<string, string> = {
  needs_discussion: "A speaker was unsure",
  rejected: "A speaker rejected it",
  different_approved_texts: "Speakers proposed different wording",
  unreviewed: "No speaker response yet",
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-BE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function saveSession(session: AuthSession) {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, session.access_token);
  sessionStorage.setItem(REFRESH_TOKEN_KEY, session.refresh_token);
}

function clearSession() {
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

async function authRequest(
  grant: "password" | "refresh_token",
  value: string,
) {
  const body =
    grant === "password"
      ? { email: DASHBOARD_EMAIL, password: value }
      : { refresh_token: value };
  const response = await fetch(`${AUTH_ENDPOINT}?grant_type=${grant}`, {
    method: "POST",
    headers: {
      apikey: PUBLISHABLE_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("auth_failed");
  return (await response.json()) as AuthSession;
}

async function fetchPrivateResults(accessToken: string) {
  return fetch(RESULTS_ENDPOINT, {
    headers: {
      apikey: PUBLISHABLE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
}

export default function ResultsPage() {
  const [evaluation, setEvaluation] = useState<EvalSet | null>(null);
  const [results, setResults] = useState<ResultsResponse | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [copied, setCopied] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [domain, setDomain] = useState("all");
  const [query, setQuery] = useState("");

  const loadResults = useCallback(async (accessToken: string) => {
    setLoading(true);
    setLoadError("");
    try {
      let response = await fetchPrivateResults(accessToken);
      if (response.status === 401) {
        const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
        if (!refreshToken) throw new Error("session_expired");
        const refreshed = await authRequest("refresh_token", refreshToken);
        saveSession(refreshed);
        response = await fetchPrivateResults(refreshed.access_token);
      }
      if (response.status === 401 || response.status === 403) {
        throw new Error("session_expired");
      }
      if (!response.ok) throw new Error("results_failed");
      const payload = (await response.json()) as ResultsResponse;
      setResults(payload);
      setAuthenticated(true);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "session_expired"
      ) {
        clearSession();
        setAuthenticated(false);
        setResults(null);
        setAuthError("Your session expired. Please sign in again.");
      } else {
        setLoadError("The results could not be refreshed. Please try again.");
      }
    } finally {
      setLoading(false);
      setCheckingSession(false);
    }
  }, []);

  useEffect(() => {
    fetch("/evaluation.json")
      .then((response) => {
        if (!response.ok) throw new Error("evaluation_failed");
        return response.json() as Promise<EvalSet>;
      })
      .then(setEvaluation)
      .catch(() =>
        setLoadError("The evaluation set could not be loaded."),
      );

    const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
    const frame = window.requestAnimationFrame(() => {
      if (token) {
        void loadResults(token);
      } else {
        setCheckingSession(false);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [loadResults]);

  const dashboard = useMemo(() => {
    if (!evaluation || !results) return null;
    return aggregateReviewResults(
      evaluation,
      results.submissions,
    ) as {
      reviewers: Array<{
        id: string;
        name: string;
        submitted_at: string;
        reviewed: number;
        approved_as_written: number;
        corrected: number;
        unsure: number;
        rejected: number;
      }>;
      lines: Array<
        EvalLine & {
          resolution: Filter;
          final_text: string | null;
          changed?: boolean;
          reasons: string[];
          responses: Array<{
            reviewer: string;
            status: ReviewStatus;
            corrected_text: string;
            note: string;
          }>;
        }
      >;
      domains: Record<
        string,
        {
          label: string;
          accepted: number;
          total: number;
          required: number;
          passed: boolean;
        }
      >;
      summary: {
        reviewer_count: number;
        accepted_lines: number;
        corrected_lines: number;
        conflict_lines: number;
        unreviewed_lines: number;
        target_accepted: number;
        total_lines: number;
        gate_requirements_met: boolean;
        ready_to_lock: boolean;
      };
    };
  }, [evaluation, results]);

  const visibleLines = useMemo(() => {
    if (!dashboard) return [];
    const normalizedQuery = query.trim().toLowerCase();
    return dashboard.lines.filter((line) => {
      const matchesFilter =
        filter === "all" || line.resolution === filter;
      const matchesDomain = domain === "all" || line.domain === domain;
      const matchesQuery =
        !normalizedQuery ||
        [line.id, line.text, line.final_text, line.intent_en]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(normalizedQuery),
          );
      return matchesFilter && matchesDomain && matchesQuery;
    });
  }, [dashboard, domain, filter, query]);

  async function signIn(event: FormEvent) {
    event.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setAuthError("");
    try {
      const session = await authRequest("password", password);
      saveSession(session);
      setPassword("");
      await loadResults(session.access_token);
    } catch {
      setAuthError(
        "That password did not work. Use the Intellingo password for contact@intellingo.app.",
      );
      setLoading(false);
    }
  }

  function signOut() {
    clearSession();
    setAuthenticated(false);
    setResults(null);
    setPassword("");
    setAuthError("");
  }

  async function copyEvaluatorLink() {
    await navigator.clipboard.writeText(EVALUATOR_LINK);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  function downloadReport() {
    if (!dashboard || !results) return;
    const content = JSON.stringify(
      {
        generated_at: results.generated_at,
        set_id: results.set_id,
        excluded_test_submissions: results.excluded_test_submissions,
        ...dashboard,
      },
      null,
      2,
    );
    const url = URL.createObjectURL(
      new Blob([content], { type: "application/json" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `lingala-evaluation-results-${new Date()
      .toISOString()
      .slice(0, 10)}.json`;
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  if (checkingSession) {
    return (
      <main className="results-login-shell">
        <div className="results-login-card results-checking" aria-live="polite">
          <span className="results-seal" aria-hidden="true">LN</span>
          <p>Opening the private results desk…</p>
        </div>
      </main>
    );
  }

  if (!authenticated || !dashboard || !results) {
    return (
      <main className="results-login-shell">
        <section className="results-login-card">
          <div className="results-login-brand">
            <p className="results-eyebrow">Intellingo · Private research</p>
            <span className="results-seal" aria-hidden="true">LN</span>
            <h1>Lingala review<br />results<span>.</span></h1>
            <p>
              Speaker names and sentence-level feedback stay behind your
              existing Intellingo account.
            </p>
          </div>
          <form className="results-login-form" onSubmit={signIn}>
            <div className="results-account">
              <span>Account</span>
              <strong>{DASHBOARD_EMAIL}</strong>
            </div>
            <label htmlFor="results-password">Intellingo password</label>
            <input
              id="results-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              placeholder="Enter your password"
              required
            />
            {authError && (
              <p className="results-form-error" role="alert">{authError}</p>
            )}
            {loadError && (
              <p className="results-form-error" role="alert">{loadError}</p>
            )}
            <button type="submit" disabled={loading}>
              {loading ? "Opening…" : "Open results dashboard"}
              <span aria-hidden="true">→</span>
            </button>
            <small>
              The public evaluator cannot access this page or its data.
            </small>
          </form>
        </section>
      </main>
    );
  }

  const summary = dashboard.summary;
  const status =
    summary.reviewer_count === 0
      ? {
          label: "Waiting for reviews",
          title: "The desk is ready.",
          body: "No real speaker has submitted yet. Share the evaluator link and this dashboard will update automatically.",
          className: "waiting",
        }
      : summary.ready_to_lock
        ? {
            label: "Phase 2 gate passed",
            title: "The prototype is ready to lock.",
            body: "All written requirements are satisfied and no sentence conflicts remain.",
            className: "passed",
          }
        : summary.gate_requirements_met
          ? {
              label: "Manual review needed",
              title: "The numbers pass; conflicts remain.",
              body: "Resolve the highlighted sentence disagreements before locking the prototype.",
              className: "attention",
            }
          : {
              label: "Review in progress",
              title: "More evidence is needed.",
              body: "The dashboard shows exactly which overall or domain requirement is still short.",
              className: "progressing",
            };

  return (
    <main className="results-shell">
      <header className="results-topbar">
        <Link href="/" className="results-wordmark">
          Évaluation Lingala<span>.</span>
        </Link>
        <div>
          <button
            className="results-refresh-button"
            onClick={() => {
              const token = sessionStorage.getItem(ACCESS_TOKEN_KEY);
              if (token) void loadResults(token);
            }}
            disabled={loading}
            type="button"
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
          <button
            className="results-signout-button"
            onClick={signOut}
            type="button"
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="results-canvas">
        <section className={`results-hero ${status.className}`}>
          <div className="results-hero-copy">
            <p className="results-eyebrow">{status.label}</p>
            <h1>{status.title}</h1>
            <p>{status.body}</p>
            <div className="results-hero-actions">
              <button onClick={copyEvaluatorLink} type="button">
                {copied ? "Link copied" : "Copy evaluator link"}
              </button>
              <button
                className="secondary"
                onClick={downloadReport}
                type="button"
              >
                Download report
              </button>
            </div>
          </div>
          <div className="results-score">
            <span>Accepted</span>
            <strong>{summary.accepted_lines}</strong>
            <small>of {summary.total_lines}</small>
            <div
              role="progressbar"
              aria-label="Accepted sentences"
              aria-valuemin={0}
              aria-valuemax={summary.total_lines}
              aria-valuenow={summary.accepted_lines}
            >
              <span
                style={{
                  width: `${(summary.accepted_lines / summary.total_lines) * 100}%`,
                }}
              />
            </div>
            <p>Target: {summary.target_accepted}</p>
          </div>
        </section>

        <section className="results-metrics" aria-label="Review summary">
          <article>
            <span>Speakers</span>
            <strong>{summary.reviewer_count}</strong>
            <small>real submissions</small>
          </article>
          <article>
            <span>Accepted</span>
            <strong>{summary.accepted_lines}</strong>
            <small>{summary.corrected_lines} with corrections</small>
          </article>
          <article className={summary.conflict_lines ? "metric-alert" : ""}>
            <span>Conflicts</span>
            <strong>{summary.conflict_lines}</strong>
            <small>need your decision</small>
          </article>
          <article>
            <span>Unreviewed</span>
            <strong>{summary.unreviewed_lines}</strong>
            <small>of 50 sentences</small>
          </article>
        </section>

        <section className="results-grid">
          <article className="results-panel results-domain-panel">
            <div className="results-panel-heading">
              <div>
                <p className="results-eyebrow">Gate coverage</p>
                <h2>Every domain needs five.</h2>
              </div>
              <span className="results-rule-chip">5 × 8 domains</span>
            </div>
            <div className="results-domain-list">
              {DOMAIN_ORDER.map((domainKey) => {
                const domainResult = dashboard.domains[domainKey];
                return (
                  <div className="results-domain-row" key={domainKey}>
                    <div>
                      <span>{domainResult.label}</span>
                      <strong>
                        {domainResult.accepted} / {domainResult.required}
                      </strong>
                    </div>
                    <div className="results-domain-track">
                      <span
                        className={domainResult.passed ? "passed" : ""}
                        style={{
                          width: `${Math.min(
                            100,
                            (domainResult.accepted / domainResult.required) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </article>

          <article className="results-panel results-reviewer-panel">
            <div className="results-panel-heading">
              <div>
                <p className="results-eyebrow">People</p>
                <h2>Speaker submissions</h2>
              </div>
              <span className="results-rule-chip">
                {results.excluded_test_submissions} tests hidden
              </span>
            </div>
            {dashboard.reviewers.length ? (
              <div className="results-reviewer-list">
                {dashboard.reviewers.map((reviewer) => (
                  <article key={reviewer.id}>
                    <div className="results-avatar" aria-hidden="true">
                      {reviewer.name
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div className="results-reviewer-copy">
                      <strong>{reviewer.name}</strong>
                      <span>{formatDate(reviewer.submitted_at)}</span>
                      <div>
                        <span>{reviewer.approved_as_written} natural</span>
                        <span>{reviewer.corrected} corrected</span>
                        <span>{reviewer.unsure + reviewer.rejected} flagged</span>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="results-empty-reviewers">
                <span aria-hidden="true">01</span>
                <h3>Waiting for the first speaker</h3>
                <p>
                  Once Tantine or another speaker taps “Send my answers,” their
                  completed review appears here automatically.
                </p>
              </div>
            )}
          </article>
        </section>

        {dashboard.reviewers.length > 0 && (
          <section className="results-panel results-sentences">
            <div className="results-panel-heading results-sentence-heading">
              <div>
                <p className="results-eyebrow">Sentence desk</p>
                <h2>Agreement, corrections and conflicts</h2>
              </div>
              <span>{visibleLines.length} shown</span>
            </div>

            <div className="results-filters">
              <label>
                <span>Search</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Sentence, meaning or ID"
                />
              </label>
              <label>
                <span>Status</span>
                <select
                  value={filter}
                  onChange={(event) =>
                    setFilter(event.target.value as Filter)
                  }
                >
                  <option value="all">All sentences</option>
                  <option value="accepted">Accepted</option>
                  <option value="conflict">Conflicts</option>
                  <option value="unreviewed">Unreviewed</option>
                </select>
              </label>
              <label>
                <span>Domain</span>
                <select
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                >
                  <option value="all">All domains</option>
                  {DOMAIN_ORDER.map((domainKey) => (
                    <option value={domainKey} key={domainKey}>
                      {DOMAIN_LABELS[domainKey]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="results-line-list">
              {visibleLines.map((line) => (
                <article
                  className={`results-line-card resolution-${line.resolution}`}
                  key={line.id}
                >
                  <div className="results-line-meta">
                    <span>{line.id}</span>
                    <span>{DOMAIN_LABELS[line.domain]}</span>
                    <strong>{line.resolution}</strong>
                  </div>
                  <p className="results-line-text" lang="ln">{line.text}</p>
                  {line.changed && line.final_text && (
                    <div className="results-final-text">
                      <span>Agreed correction</span>
                      <p lang="ln">{line.final_text}</p>
                    </div>
                  )}
                  {line.reasons.length > 0 && (
                    <div className="results-reasons">
                      {line.reasons.map((reason) => (
                        <span key={reason}>{REASON_COPY[reason] ?? reason}</span>
                      ))}
                    </div>
                  )}
                  <details>
                    <summary>
                      See {line.responses.length} speaker{" "}
                      {line.responses.length === 1 ? "answer" : "answers"}
                    </summary>
                    <div className="results-response-list">
                      {line.responses.map((response) => (
                        <article
                          key={`${line.id}-${response.reviewer}`}
                        >
                          <div>
                            <strong>{response.reviewer}</strong>
                            <span>{STATUS_COPY[response.status]}</span>
                          </div>
                          {response.corrected_text && (
                            <p lang="ln">{response.corrected_text}</p>
                          )}
                          {response.note && (
                            <small>Note: {response.note}</small>
                          )}
                        </article>
                      ))}
                    </div>
                  </details>
                </article>
              ))}
            </div>
          </section>
        )}

        <footer className="results-footer">
          <p>
            Updated {formatDate(results.generated_at)} · Test submissions are
            excluded · Evaluation text is never used for training
          </p>
          <p>
            A sentence is accepted automatically only when every speaker
            approves the same wording.
          </p>
        </footer>
      </div>
    </main>
  );
}
