"use client";

import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

function fmtWhen(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

function fmtTokens(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

function fmtUsd(n, digits = 4) {
  return `$${Number(n || 0).toFixed(digits)}`;
}

export default function AdminUsagePage() {
  const [summary, setSummary] = useState([]);
  const [rows, setRows] = useState([]);
  const [openaiCosts, setOpenaiCosts] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    const qs = debouncedQ ? `?q=${encodeURIComponent(debouncedQ)}` : "";
    const logQs = debouncedQ
      ? `?limit=100&q=${encodeURIComponent(debouncedQ)}`
      : "?limit=100";
    Promise.all([
      api("/v1/admin/openai-costs"),
      api(`/v1/admin/usage/summary${qs}`),
      api(`/v1/admin/usage${logQs}`),
    ])
      .then(([costs, sum, events]) => {
        if (cancelled) return;
        setOpenaiCosts(costs);
        setSummary(sum);
        setRows(events);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQ]);

  return (
    <>
      <h1>Usage</h1>
      <p className="muted">
        Per-tenant voice minutes and tokens this month. Billing total comes from OpenAI (actual spend).
      </p>

      {openaiCosts ? (
        <div className="card openai-cost-card">
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>OpenAI actual spend (this month)</h2>
          {openaiCosts.ok ? (
            <>
              <div className="openai-cost-total">{fmtUsd(openaiCosts.cost_usd, 2)}</div>
              <p className="muted" style={{ margin: "8px 0 0" }}>
                Source: OpenAI Costs API · organization total (matches platform.openai.com billing)
              </p>
              {openaiCosts.line_items?.length ? (
                <ul className="openai-cost-lines">
                  {openaiCosts.line_items.map((row) => (
                    <li key={row.line_item}>
                      <span>{row.line_item}</span>
                      <strong>{fmtUsd(row.cost_usd, 2)}</strong>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          ) : (
            <p className="error" style={{ margin: 0 }}>
              {openaiCosts.error ||
                "Could not load OpenAI billing. Add OPENAI_ADMIN_API_KEY to .env (Admin key from platform.openai.com)."}
            </p>
          )}
        </div>
      ) : null}

      <div className="usage-toolbar">
        <input
          type="search"
          placeholder="Search tenant, agent, or room…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search usage"
        />
        {debouncedQ ? (
          <button type="button" className="secondary" onClick={() => setQuery("")}>
            Clear
          </button>
        ) : null}
      </div>

      {error ? <p className="error">{error}</p> : null}
      {loading ? <p className="muted">Loading…</p> : null}

      {!loading && !error ? (
        <>
          <h2 className="usage-section-title">By tenant (this month)</h2>
          {summary.length === 0 ? (
            <p className="muted">
              {debouncedQ
                ? "No tenants match this search."
                : "No AI usage events this month yet."}
            </p>
          ) : (
            <div className="usage-table-wrap">
              <table className="usage-table">
                <thead>
                  <tr>
                    <th>Tenant</th>
                    <th>Calls</th>
                    <th>Minutes</th>
                    <th>Tokens in</th>
                    <th>Tokens out</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.map((s) => {
                    const tin = (s.input_tokens || 0) + (s.audio_input_tokens || 0);
                    const tout = (s.output_tokens || 0) + (s.audio_output_tokens || 0);
                    return (
                      <tr key={s.user_id || s.user_email}>
                        <td>
                          <strong>{s.user_email || `User #${s.user_id}`}</strong>
                        </td>
                        <td className="num">{s.calls}</td>
                        <td className="num">{Number(s.minutes || 0).toFixed(2)}</td>
                        <td className="num">{fmtTokens(tin)}</td>
                        <td className="num">{fmtTokens(tout)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <h2 className="usage-section-title">Recent calls</h2>
          {rows.length === 0 ? (
            <p className="muted">
              {debouncedQ ? "No calls match this search." : "No call log entries yet."}
            </p>
          ) : (
            <div className="usage-table-wrap">
              <table className="usage-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Tenant</th>
                    <th>Agent</th>
                    <th>Model</th>
                    <th>In</th>
                    <th>Out</th>
                    <th>Minutes</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const tin = (r.input_tokens || 0) + (r.audio_input_tokens || 0);
                    const tout = (r.output_tokens || 0) + (r.audio_output_tokens || 0);
                    return (
                      <tr key={r.id}>
                        <td>{fmtWhen(r.created_at)}</td>
                        <td>{r.user_email || "—"}</td>
                        <td>{r.agent_name}</td>
                        <td>
                          <code>{r.model || "—"}</code>
                        </td>
                        <td className="num">{tin}</td>
                        <td className="num">{tout}</td>
                        <td className="num">{Number(r.minutes || 0).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </>
  );
}
