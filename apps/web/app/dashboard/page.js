"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Nav from "../components/Nav";
import { api, getToken } from "../../lib/api";

function displayName(email) {
  if (!email) return "Account";
  const local = String(email).split("@")[0] || "Account";
  return local
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function initials(email) {
  const name = displayName(email);
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0] || "U").slice(0, 2).toUpperCase();
}

function fmtTokens(n) {
  const v = Number(n) || 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}k`;
  return String(v);
}

function fmtUsd(n) {
  return `$${Number(n || 0).toFixed(4)}`;
}

function shortModel(model) {
  if (!model) return "—";
  return String(model).replace(/^gpt-/, "");
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [agents, setAgents] = useState([]);
  const [name, setName] = useState("Support bot");
  const [error, setError] = useState("");
  const [secret, setSecret] = useState("");
  const [usage, setUsage] = useState(null);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api("/v1/auth/me")
      .then((me) => {
        if (me.is_admin) {
          router.replace("/admin");
          return;
        }
        if (!me.is_approved) {
          router.replace("/pending");
          return;
        }
        setUser(me);
        setAllowed(true);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    api("/v1/agents")
      .then((rows) => {
        if (!cancelled) setAgents(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    api("/v1/me/usage")
      .then((data) => {
        if (!cancelled) setUsage(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setUsage(null);
          setError((prev) => prev || err.message);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [allowed]);

  async function createAgent(e) {
    e.preventDefault();
    setError("");
    try {
      const created = await api("/v1/agents", {
        method: "POST",
        body: JSON.stringify({ name }),
      });
      setSecret(created.secret || "");
      setAgents((prev) => [created, ...prev]);
      setName("Support bot");
    } catch (err) {
      setError(err.message);
    }
  }

  if (!allowed) {
    return (
      <>
        <Nav />
        <main className="wrap">
          <p className="muted">Loading dashboard…</p>
        </main>
      </>
    );
  }

  const plan = usage?.plan_minutes ?? user?.plan_minutes ?? 120;
  const aiMinutes = (usage?.by_model || []).reduce(
    (sum, row) => sum + (Number(row.minutes) || 0),
    0
  );
  const used = Math.max(Number(usage?.used_minutes) || 0, aiMinutes);
  const remaining = Math.max(0, plan - used);
  const pct = plan > 0 ? Math.min(100, Math.round((used / plan) * 100)) : 0;
  const tin = (usage?.input_tokens_month || 0) + (usage?.audio_input_tokens_month || 0);
  const tout = (usage?.output_tokens_month || 0) + (usage?.audio_output_tokens_month || 0);

  return (
    <>
      <Nav />
      <main className="wrap dash">
        <section className="dash-hero">
          <div className="dash-profile">
            <div className="dash-avatar" aria-hidden="true">
              {initials(user?.email)}
            </div>
            <div>
              <p className="dash-kicker">Workspace</p>
              <h1 className="dash-title">{displayName(user?.email)}</h1>
              <p className="muted dash-email">{user?.email}</p>
            </div>
          </div>
          <div className="dash-plan">
            <span className="badge">Plan · {plan} min / month</span>
            <p className="muted" style={{ margin: "8px 0 0" }}>
              {agents.length} agent{agents.length === 1 ? "" : "s"}
            </p>
          </div>
        </section>

        <section className="dash-kpis">
          <div className="dash-kpi">
            <span className="dash-kpi-label">Minutes used</span>
            <div className="dash-kpi-value">
              {Number(used).toFixed(1)}
              <span className="dash-kpi-unit">/ {plan}</span>
            </div>
            <div className="dash-meter" aria-hidden="true">
              <span style={{ width: `${pct}%` }} />
            </div>
            <p className="dash-kpi-sub">{Number(remaining).toFixed(1)} min left this month</p>
          </div>
          <div className="dash-kpi">
            <span className="dash-kpi-label">AI calls</span>
            <div className="dash-kpi-value">{usage?.calls_month ?? 0}</div>
            <p className="dash-kpi-sub">Logged realtime sessions</p>
          </div>
          <div className="dash-kpi">
            <span className="dash-kpi-label">Est. OpenAI cost</span>
            <div className="dash-kpi-value dash-kpi-sm">{fmtUsd(usage?.cost_usd_month)}</div>
            <p className="dash-kpi-sub">Based on tokens × rates</p>
          </div>
          <div className="dash-kpi">
            <span className="dash-kpi-label">Tokens in / out</span>
            <div className="dash-kpi-value dash-kpi-sm">
              {fmtTokens(tin)} / {fmtTokens(tout)}
            </div>
            <p className="dash-kpi-sub">Text + audio this month</p>
          </div>
        </section>

        <section className="card dash-section">
          <div className="dash-section-head">
            <div>
              <h2>Model usage</h2>
              <p className="muted">Which realtime models this account used this month.</p>
            </div>
          </div>
          {!usage?.by_model?.length ? (
            <p className="muted">No AI usage yet. After a voice call, model breakdown appears here.</p>
          ) : (
            <div className="usage-table-wrap">
              <table className="usage-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Calls</th>
                    <th>Minutes</th>
                    <th>In</th>
                    <th>Out</th>
                    <th>Est. cost</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.by_model.map((row) => {
                    const inTok =
                      (row.input_tokens || 0) + (row.audio_input_tokens || 0);
                    const outTok =
                      (row.output_tokens || 0) + (row.audio_output_tokens || 0);
                    return (
                      <tr key={row.model}>
                        <td>
                          <code>{row.model}</code>
                        </td>
                        <td className="num">{row.calls}</td>
                        <td className="num">{Number(row.minutes || 0).toFixed(2)}</td>
                        <td className="num">{fmtTokens(inTok)}</td>
                        <td className="num">{fmtTokens(outTok)}</td>
                        <td className="num cost">{fmtUsd(row.cost_usd)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card dash-section">
          <div className="dash-section-head">
            <div>
              <h2>Agents</h2>
              <p className="muted">
                Each agent has a public key for WordPress / any website embed.
              </p>
            </div>
          </div>

          <form className="dash-create" onSubmit={createAgent}>
            <label>New agent name</label>
            <div className="dash-create-row">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Support bot"
                required
              />
              <button type="submit">Create</button>
            </div>
          </form>
          {secret ? (
            <p className="muted">
              Agent secret (shown once): <code>{secret}</code>
            </p>
          ) : null}
          {error ? <p className="error">{error}</p> : null}

          <div className="dash-agent-list">
            {agents.length === 0 ? (
              <p className="muted">No agents yet — create one above.</p>
            ) : (
              agents.map((agent) => (
                <div className="dash-agent" key={agent.id}>
                  <div className="dash-agent-main">
                    <strong>{agent.name}</strong>
                    <div className="muted dash-agent-meta">
                      <code>{agent.public_key}</code>
                      <span>
                        Model · {shortModel(agent.realtime_model || "gpt-4o-realtime-preview")}
                      </span>
                      <span>Voice · {agent.voice || "alloy"}</span>
                      <span>Q&A {agent.modules?.qa ? "on" : "off"}</span>
                    </div>
                  </div>
                  <Link className="btn" href={`/agents/${agent.id}`}>
                    Open
                  </Link>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </>
  );
}
