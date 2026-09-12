"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "../../../lib/api";

const LAUNCHER_MODES = [
  { id: "mic", label: "Mic button (style only)" },
  { id: "avatar", label: "Avatar face button" },
  { id: "floating", label: "Floating idle character" },
];

function agentEditState(a, opts, packs, skins) {
  return {
    name: a.name,
    voice: a.voice || "alloy",
    realtime_model: a.realtime_model || opts?.models?.[0]?.id || "gpt-4o-realtime-preview",
    character_enabled: Boolean(a.character_enabled),
    character_pack: a.character_pack || packs?.[0]?.id || "character_emoji",
    launcher_mode: a.launcher_mode || "mic",
    launcher_skin: a.launcher_skin || skins?.[0]?.id || "",
    launcher_label: a.launcher_label || "Tap to talk with AI",
    launcher_color: a.launcher_color || "#2563eb",
    launcher_size: a.launcher_size ?? 160,
    character_size: a.character_size ?? 200,
    panel_width: a.panel_width ?? 280,
    show_transcription: Boolean(a.show_transcription),
    max_call_minutes: a.max_call_minutes ?? 10,
  };
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState([]);
  const [options, setOptions] = useState(null);
  const [characterPacks, setCharacterPacks] = useState([]);
  const [launcherSkins, setLauncherSkins] = useState([]);
  const [error, setError] = useState("");
  const [savedId, setSavedId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [edits, setEdits] = useState({});

  useEffect(() => {
    Promise.all([
      api("/v1/admin/agents"),
      api("/v1/admin/realtime-options"),
      api("/v1/admin/character-packs"),
      api("/v1/admin/launcher-skins"),
    ])
      .then(([rows, opts, packs, skins]) => {
        setAgents(rows);
        setOptions(opts);
        setCharacterPacks(packs);
        setLauncherSkins(skins);
        const next = {};
        rows.forEach((a) => {
          next[a.id] = agentEditState(a, opts, packs, skins);
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
    const mode = patch.launcher_mode || "mic";
    if ((mode === "avatar" || mode === "floating") && !patch.launcher_skin) {
      setError("Pick a launcher skin for avatar/floating mode");
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
          launcher_mode: mode,
          launcher_skin: patch.launcher_skin || null,
          launcher_label: patch.launcher_label,
          launcher_color: patch.launcher_color,
          launcher_size: Number(patch.launcher_size) || 160,
          character_size: Number(patch.character_size) || 200,
          panel_width: Number(patch.panel_width) || 280,
          show_transcription: Boolean(patch.show_transcription),
          max_call_minutes: Number(patch.max_call_minutes) || 10,
        }),
      });
      setAgents((prev) => prev.map((a) => (a.id === id ? updated : a)));
      setEdits((prev) => ({
        ...prev,
        [id]: agentEditState(updated, options, characterPacks, launcherSkins),
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

  function patchField(id, field, value) {
    setEdits((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value },
    }));
  }

  return (
    <>
      <h1>Agents</h1>
      <p className="muted">
        Change name, realtime model, voice, idle widget look, then click <strong>Save</strong>. For Knowledge
        Base, bookings, orders, and modules, open the agent settings page.
      </p>
      {error ? <p className="error">{error}</p> : null}
      {!options && !error ? <p className="muted">Loading…</p> : null}
      <div className="list">
        {agents.map((agent) => {
          const edit = edits[agent.id] || {};
          const needsSkin = edit.launcher_mode === "avatar" || edit.launcher_mode === "floating";
          return (
            <div className="card" key={agent.id}>
              <div className="item">
                <div>
                  <strong>{edit.name || agent.name}</strong>
                  <div className="muted">
                    {agent.public_key} · owner {agent.user_email}
                  </div>
                  <div className="muted">
                    {edit.realtime_model || agent.realtime_model} · voice{" "}
                    {voiceLabel(edit.voice || agent.voice)}
                    {" · "}
                    {edit.max_call_minutes ?? agent.max_call_minutes ?? 10} min/call
                    {edit.character_enabled ? " · character on" : ""}
                    {" · idle "}
                    {edit.launcher_mode || "mic"}
                  </div>
                </div>
                <span className="badge">#{agent.id}</span>
              </div>
              <label>Name</label>
              <input
                value={edit.name ?? ""}
                onChange={(e) => patchField(agent.id, "name", e.target.value)}
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
                      value={edit.realtime_model || "gpt-4o-realtime-preview"}
                      onChange={(e) => patchField(agent.id, "realtime_model", e.target.value)}
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
                      value={edit.voice || "alloy"}
                      onChange={(e) => patchField(agent.id, "voice", e.target.value)}
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
                  <label>Max call length (minutes)</label>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={edit.max_call_minutes ?? 10}
                    onChange={(e) =>
                      patchField(agent.id, "max_call_minutes", Number(e.target.value) || 1)
                    }
                  />
                </div>
                <div>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={Boolean(edit.character_enabled)}
                      onChange={(e) => patchField(agent.id, "character_enabled", e.target.checked)}
                    />
                    In-call character animation
                  </label>
                </div>
                <div>
                  <label>Character pack</label>
                  <select
                    value={edit.character_pack || "character_emoji"}
                    disabled={!edit.character_enabled}
                    onChange={(e) => patchField(agent.id, "character_pack", e.target.value)}
                  >
                    {(characterPacks.length
                      ? characterPacks
                      : [{ id: "character_emoji", label: "Character Emoji" }]
                    ).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="settings-row" style={{ marginTop: 12 }}>
                <div>
                  <label>Idle widget look</label>
                  <select
                    value={edit.launcher_mode || "mic"}
                    onChange={(e) => patchField(agent.id, "launcher_mode", e.target.value)}
                  >
                    {LAUNCHER_MODES.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Launcher skin</label>
                  <select
                    value={edit.launcher_skin || ""}
                    disabled={!needsSkin}
                    onChange={(e) => patchField(agent.id, "launcher_skin", e.target.value)}
                  >
                    {!launcherSkins.length ? (
                      <option value="">No skins found</option>
                    ) : (
                      launcherSkins.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label>Idle label</label>
                  <input
                    value={edit.launcher_label || ""}
                    onChange={(e) => patchField(agent.id, "launcher_label", e.target.value)}
                    maxLength={80}
                  />
                </div>
                <div>
                  <label>Accent color</label>
                  <input
                    type="color"
                    value={edit.launcher_color || "#2563eb"}
                    onChange={(e) => patchField(agent.id, "launcher_color", e.target.value)}
                  />
                </div>
                <div>
                  <label>Idle avatar size (px)</label>
                  <input
                    type="number"
                    min={80}
                    max={320}
                    value={edit.launcher_size ?? 160}
                    onChange={(e) =>
                      patchField(agent.id, "launcher_size", Number(e.target.value) || 160)
                    }
                  />
                </div>
                <div>
                  <label>In-call character size (px)</label>
                  <input
                    type="number"
                    min={120}
                    max={400}
                    value={edit.character_size ?? 200}
                    onChange={(e) =>
                      patchField(agent.id, "character_size", Number(e.target.value) || 200)
                    }
                  />
                </div>
                <div>
                  <label>Panel width (px)</label>
                  <input
                    type="number"
                    min={220}
                    max={420}
                    value={edit.panel_width ?? 280}
                    onChange={(e) =>
                      patchField(agent.id, "panel_width", Number(e.target.value) || 280)
                    }
                  />
                </div>
                <div>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(edit.show_transcription)}
                      onChange={(e) =>
                        patchField(agent.id, "show_transcription", e.target.checked)
                      }
                    />{" "}
                    Show live transcription
                  </label>
                </div>
              </div>
              {needsSkin && edit.launcher_skin
                ? (() => {
                    const skin = launcherSkins.find((s) => s.id === edit.launcher_skin);
                    if (!skin?.preview_url) return null;
                    const src = skin.preview_url.startsWith("http")
                      ? skin.preview_url
                      : `${process.env.NEXT_PUBLIC_API_URL || ""}${skin.preview_url}`;
                    return (
                      <p className="muted" style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 10 }}>
                        <img
                          src={src}
                          alt=""
                          width={48}
                          height={48}
                          style={{ borderRadius: 10, objectFit: "cover", background: "#000" }}
                        />
                        Preview: {skin.label}
                      </p>
                    );
                  })()
                : null}
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
                  onClick={() => deleteAgent(agent.id, edit.name || agent.name)}
                >
                  Delete
                </button>
              </div>
              <p className="muted" style={{ marginTop: 8, marginBottom: 0 }}>
                Settings page has Knowledge, Bookings, Orders, Catalog, Support, Embed…
              </p>
            </div>
          );
        })}
      </div>
    </>
  );
}
