"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Nav from "../../components/Nav";
import AgentTabs from "./tabs";
import { api, getToken } from "../../../lib/api";

export default function AgentSettingsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [agent, setAgent] = useState(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api(`/v1/agents/${id}`)
      .then(setAgent)
      .catch((err) => setError(err.message));
  }, [id, router]);

  async function save(e) {
    e.preventDefault();
    setError("");
    setSaved(false);
    try {
      const updated = await api(`/v1/agents/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: agent.name,
          language: agent.language,
          voice: agent.voice,
          system_prompt: agent.system_prompt,
          allowed_origins: agent.allowed_origins,
          max_call_minutes: Number(agent.max_call_minutes) || 10,
          modules: agent.modules,
        }),
      });
      setAgent(updated);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    }
  }

  if (!agent) {
    return (
      <>
        <Nav />
        <main className="wrap">{error ? <p className="error">{error}</p> : <p>Loading…</p>}</main>
      </>
    );
  }

  const modules = agent.modules || { qa: true, support: false, booking: false, orders: false };

  return (
    <>
      <Nav />
      <main className="wrap">
        <h1>{agent.name}</h1>
        <AgentTabs id={id} current="settings" />
        <form className="card" onSubmit={save}>
          <label>Name</label>
          <input value={agent.name} onChange={(e) => setAgent({ ...agent, name: e.target.value })} />
          <label>Language</label>
          <input value={agent.language} onChange={(e) => setAgent({ ...agent, language: e.target.value })} />
          <label>Voice</label>
          <select value={agent.voice} onChange={(e) => setAgent({ ...agent, voice: e.target.value })}>
            <option value="alloy">Alloy</option>
            <option value="ash">Ash</option>
            <option value="ballad">Ballad</option>
            <option value="cedar">Cedar (Male)</option>
            <option value="coral">Coral</option>
            <option value="echo">Echo</option>
            <option value="marin">Marin (Female)</option>
            <option value="sage">Sage</option>
            <option value="shimmer">Shimmer</option>
            <option value="verse">Verse</option>
          </select>
          <label>System prompt</label>
          <textarea
            value={agent.system_prompt}
            onChange={(e) => setAgent({ ...agent, system_prompt: e.target.value })}
          />
          <label>Allowed origins (comma-separated domains, empty = block until set)</label>
          <input
            value={agent.allowed_origins}
            onChange={(e) => setAgent({ ...agent, allowed_origins: e.target.value })}
          />
          <label>Max call length (minutes)</label>
          <input
            type="number"
            min={1}
            max={120}
            value={agent.max_call_minutes ?? 10}
            onChange={(e) =>
              setAgent({ ...agent, max_call_minutes: Number(e.target.value) || 1 })
            }
          />
          <p className="muted">
            Each voice session ends automatically after this many minutes (1–120). Lower values
            reduce OpenAI cost if visitors leave the mic open.
          </p>
          <h3>Modules</h3>
          <p className="muted">Turn on only what this agent should do. Voice tools follow these flags.</p>
          {["qa", "booking", "orders", "support"].map((key) => (
            <label key={key} className="check">
              <input
                type="checkbox"
                checked={Boolean(modules[key])}
                onChange={(e) =>
                  setAgent({
                    ...agent,
                    modules: { ...modules, [key]: e.target.checked },
                  })
                }
              />
              {key === "qa" ? "Q&A" : key === "support" ? "Customer support" : key}
            </label>
          ))}
          {error ? <p className="error">{error}</p> : null}
          {saved ? <p className="muted">Saved.</p> : null}
          <div className="row" style={{ marginTop: 16 }}>
            <button type="submit">Save</button>
          </div>
        </form>
      </main>
    </>
  );
}
