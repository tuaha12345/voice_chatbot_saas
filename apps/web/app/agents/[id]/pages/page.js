"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Nav from "../../../components/Nav";
import AgentTabs from "../tabs";
import { api, getToken } from "../../../../lib/api";

const emptyRow = () => ({ key: "", label: "", path: "" });

export default function SitePagesPage() {
  const { id } = useParams();
  const router = useRouter();
  const [pages, setPages] = useState([emptyRow()]);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api(`/v1/agents/${id}/site-pages`)
      .then((data) => {
        const rows = data.pages?.length ? data.pages : [emptyRow()];
        setPages(rows);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, router]);

  function updateRow(index, field, value) {
    setPages((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  function addRow() {
    setPages((prev) => [...prev, emptyRow()]);
  }

  function removeRow(index) {
    setPages((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length ? next : [emptyRow()];
    });
  }

  async function save(e) {
    e.preventDefault();
    setError("");
    setSaved(false);
    const cleaned = pages
      .map((p) => ({
        key: (p.key || "").trim().toLowerCase(),
        label: (p.label || "").trim(),
        path: (p.path || "").trim(),
      }))
      .filter((p) => p.key || p.label || p.path);
    try {
      const next = await api(`/v1/agents/${id}/site-pages`, {
        method: "PUT",
        body: JSON.stringify({ pages: cleaned }),
      });
      setPages(next.pages?.length ? next.pages : [emptyRow()]);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Nav />
      <main className="wrap">
        <h1>Site pages</h1>
        <AgentTabs id={id} current="pages" />
        <div className="card">
          <p className="muted">
            Map voice commands to pages on the customer website. Prefer relative paths like{" "}
            <code>/login</code> so the same agent works on any host. Absolute{" "}
            <code>https://...</code> URLs are allowed. When a visitor asks to open a page, the
            voice agent navigates them in the same browser tab.
          </p>
          {loading ? <p className="muted">Loading…</p> : null}
          <form onSubmit={save}>
            {pages.map((row, index) => (
              <div className="settings-row" key={index} style={{ marginBottom: 12 }}>
                <div>
                  <label>Key</label>
                  <input
                    value={row.key}
                    onChange={(e) => updateRow(index, "key", e.target.value)}
                    placeholder="login"
                  />
                </div>
                <div>
                  <label>Label</label>
                  <input
                    value={row.label}
                    onChange={(e) => updateRow(index, "label", e.target.value)}
                    placeholder="Login"
                  />
                </div>
                <div>
                  <label>Path / URL</label>
                  <input
                    value={row.path}
                    onChange={(e) => updateRow(index, "path", e.target.value)}
                    placeholder="/login"
                  />
                </div>
                <div style={{ alignSelf: "end" }}>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => removeRow(index)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {error ? <p className="error">{error}</p> : null}
            {saved ? <p className="muted">Saved.</p> : null}
            <div className="row" style={{ marginTop: 12 }}>
              <button type="button" className="secondary" onClick={addRow}>
                Add page
              </button>
              <button type="submit">Save</button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
