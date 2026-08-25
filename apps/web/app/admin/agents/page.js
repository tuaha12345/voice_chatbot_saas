"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../../lib/api";

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState([]);
  const [options, setOptions] = useState(null);
  const [characterPacks, setCharacterPacks] = useState([]);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [edits, setEdits] = useState({});

  useEffect(() => {
    Promise.all([
      api("/v1/admin/agents"),
      api("/v1/admin/realtime-options"),
      api("/v1/admin/character-packs"),
    ])
      .then(([rows, opts, packs]) => {
        setAgents(rows);
        setOptions(opts);
        setCharacterPacks(packs);
        const next = {};
        rows.forEach((a) => {
          next[a.id] = {
            name: a.name,
            voice: a.voice || "alloy",
            realtime_model: a.realtime_model || opts.models?.[0]?.id || "gpt-4o-realtime-preview",
            character_enabled: Boolean(a.character_enabled),
            character_pack: a.character_pack || packs?.[0]?.id || "character_emoji",
          };
        });
        setEdits(next);
      })
      .catch((err) => setError(err.message));
  }, []);

  async function saveAgent(id) {
    setError("");
    setSavedId(null);
    const patch = edits[id];
    const name = (patch?.name || "").trim();
    if (!name) {
      setError("Agent name is required");
      return;
    }
    setSavingId(id);
    try {
      const updated = await api(`/v1/admin/agents/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name,
          voice: patch.voice,
          realtime_model: patch.realtime_model,
          character_enabled: patch.character_enabled,
          character_pack: patch.character_pack,
        }),
      });
      setAgents((prev) => prev.map((a) => (a.id === id ? updated : a)));
      setEdits((prev) => ({
        ...prev,
        [id]: {
          name: updated.name,
          voice: updated.voice,
          realtime_model: updated.realtime_model,
          character_enabled: Boolean(updated.character_enabled),
          character_pack: updated.character_pack || "character_emoji",
        },
      }));
      setSavedId(id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingId(null);
    }
  }

  async function deleteAgent(id, name) {
    if (!window.confirm(`Delete agent "${name}"? Related bookings, orders, and transcripts will be removed.`)) {
      return;
    }
    setError("");
    try {
      await api(`/v1/admin/agents/${id}`, { method: "DELETE" });
      setAgents((prev) => prev.filter((a) => a.id !== id));
      setEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      setError(err.message);
    }
  }

  function modelLabel(modelId) {
    const m = options?.models?.find((x) => x.id === modelId);
    if (!m) return modelId;
    return m.hint ? `${m.label} (${m.hint})` : m.label;
  }

  function voiceLabel(voiceId) {
    const v = options?.voices?.find((x) => x.id === voiceId);
    return v?.label || voiceId;
  }

  return (
    <>
      <h1>Agents</h1>
      <p className="muted">
        Change name, realtime model, or voice, then click <strong>Save</strong>. For Knowledge Base,
        bookings, orders, and modules, open the agent settings page.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {!options && !error ? <p className="muted">Loading…</p> : null}
      <div className="list">
        {agents.map((agent) => (
          <div className="card" key={agent.id}>
            <div className="item">
              <div>
                <strong>{edits[agent.id]?.name || agent.name}</strong>
                <div className="muted">
                  {agent.public_key} · owner {agent.user_email}
                </div>
                <div className="muted">
                  {edits[agent.id]?.realtime_model || agent.realtime_model} · voice{" "}
                  {voiceLabel(edits[agent.id]?.voice || agent.voice)}
                  {edits[agent.id]?.character_enabled ? " · character on" : ""}
                </div>
              </div>
              <span className="badge">#{agent.id}</span>
            </div>
            <label>Name</label>
            <input
              value={edits[agent.id]?.name ?? ""}
              onChange={(e) =>
                setEdits((prev) => ({
                  ...prev,
                  [agent.id]: { ...prev[agent.id], name: e.target.value },
                }))
              }
            />
            {options ? (
              <div className="settings-row">
                <div>
                  <label>Realtime provider</label>
                  <select disabled value={options.provider?.id || "openai"}>
                    <option value="openai">{options.provider?.label || "OpenAI Realtime"}</option>
                  </select>
                </div>
                <div>
                  <label>Realtime model</label>
                  <select
                    value={edits[agent.id]?.realtime_model || "gpt-4o-realtime-preview"}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [agent.id]: { ...prev[agent.id], realtime_model: e.target.value },
                      }))
                    }
                  >
                    {options.models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {modelLabel(m.id)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Voice</label>
                  <select
                    value={edits[agent.id]?.voice || "alloy"}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [agent.id]: { ...prev[agent.id], voice: e.target.value },
                      }))
                    }
                  >
                    {options.voices.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}
            <div className="settings-row" style={{ marginTop: 12 }}>
              <div>
                <label className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={Boolean(edits[agent.id]?.character_enabled)}
                    onChange={(e) =>
                      setEdits((prev) => ({
                        ...prev,
                        [agent.id]: { ...prev[agent.id], character_enabled: e.target.checked },
                      }))
                    }
                  />
                  Character animation
                </label>
              </div>
              <div>
                <label>Character pack</label>
                <select
                  value={edits[agent.id]?.character_pack || "character_emoji"}
                  disabled={!edits[agent.id]?.character_enabled}
                  onChange={(e) =>
                    setEdits((prev) => ({
                      ...prev,
                      [agent.id]: { ...prev[agent.id], character_pack: e.target.value },
                    }))
                  }
                >
                  {(characterPacks.length ? characterPacks : [{ id: "character_emoji", label: "Character Emoji" }]).map(
                    (p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </div>
            {savedId === agent.id ? <p className="muted">Saved.</p> : null}
            <div className="row" style={{ marginTop: 12 }}>
              <button
                type="button"
                disabled={savingId === agent.id}
                onClick={() => saveAgent(agent.id)}
              >
                {savingId === agent.id ? "Saving…" : "Save"}
              </button>
              <Link className="btn secondary" href={`/agents/${agent.id}`}>
                Open settings
              </Link>
              <button
                type="button"
                className="danger"
                onClick={() => deleteAgent(agent.id, edits[agent.id]?.name || agent.name)}
              >
                Delete
              </button>
            </div>
            <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
              Settings page has Knowledge, Bookings, Orders, Catalog, Support, Embed…
            </p>
          </div>
        ))}
      </div>
    </>
  );
}
