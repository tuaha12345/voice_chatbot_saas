"use client";

import { useEffect, useState } from "react";
import { api } from "../../lib/api";

function fmtTokens(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

function fmtUsd(n, digits = 2) {
  return `$${Number(n || 0).toFixed(digits)}`;
}

export default function AdminPage() {
  const [stats, setStats] = useState(null);
  const [openaiCosts, setOpenaiCosts] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api("/v1/admin/stats"), api("/v1/admin/openai-costs")])
      .then(([s, costs]) => {
        setStats(s);
        setOpenaiCosts(costs);
      })
      .catch((err) => setError(err.message));
  }, []);

  const textIn = stats?.input_tokens_month || 0;
  const textOut = stats?.output_tokens_month || 0;
  const audioIn = stats?.audio_input_tokens_month || 0;
  const audioOut = stats?.audio_output_tokens_month || 0;

  return (
    <>
      <h1>Overview</h1>
      <p className="muted">Platform KPIs for this month — tenants, voice minutes, and OpenAI billing.</p>
      {error ? <p className="error">{error}</p> : null}
      {stats ? (
        <div className="stat-grid">
          <div className="stat-card">
            <span className="stat-icon">U</span>
            <span className="stat-label">Users</span>
            <div className="stat-value">{stats.users_count}</div>
            <p className="stat-sub">Registered accounts</p>
          </div>
          <div className="stat-card">
            <span className="stat-icon">A</span>
            <span className="stat-label">Agents</span>
            <div className="stat-value">{stats.agents_count}</div>
            <p className="stat-sub">Voice agents</p>
          </div>
          <div className="stat-card">
            <span className="stat-icon">M</span>
            <span className="stat-label">Voice minutes</span>
            <div className="stat-value">{Number(stats.usage_minutes_month || 0).toFixed(1)}</div>
            <p className="stat-sub">This month (plan usage)</p>
          </div>
          <div className="stat-card">
            <span className="stat-icon">$</span>
            <span className="stat-label">OpenAI spend</span>
            <div className="stat-value">
              {openaiCosts?.ok ? fmtUsd(openaiCosts.cost_usd) : "—"}
            </div>
            <p className="stat-sub">
              {openaiCosts?.ok
                ? "Actual bill (OpenAI Costs API)"
                : openaiCosts?.error
                  ? "Set OPENAI_ADMIN_API_KEY in .env"
                  : "Loading billing…"}
            </p>
          </div>
          <div className="stat-card">
            <span className="stat-icon">T</span>
            <span className="stat-label">Tokens in / out</span>
            <div className="stat-value" style={{ fontSize: 22 }}>
              {fmtTokens(textIn + audioIn)} / {fmtTokens(textOut + audioOut)}
            </div>
            <p className="stat-sub">
              Text {fmtTokens(textIn)}→{fmtTokens(textOut)} · Audio {fmtTokens(audioIn)}→
              {fmtTokens(audioOut)}
            </p>
          </div>
          <div className="stat-card stat-model">
            <span className="stat-icon">AI</span>
            <span className="stat-label">Active model</span>
            <div className="stat-value stat-sm">{stats.model || "—"}</div>
            <p className="stat-sub">OpenAI Realtime · {stats.calls_month || 0} calls logged</p>
          </div>
        </div>
      ) : !error ? (
        <p className="muted">Loading…</p>
      ) : null}
    </>
  );
}
