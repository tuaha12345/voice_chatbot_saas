"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Nav from "../../../components/Nav";
import AgentTabs from "../tabs";
import { api, getToken } from "../../../../lib/api";

const MODES = [
  { id: "faq", label: "FAQ" },
  { id: "paste", label: "Paste text" },
  { id: "upload", label: "Upload file" },
];

export default function KnowledgePage() {
  const { id } = useParams();
  const router = useRouter();
  const [docs, setDocs] = useState([]);
  const [mode, setMode] = useState("faq");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [file, setFile] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function load() {
    api(`/v1/agents/${id}/knowledge`)
      .then(setDocs)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    load();
  }, [id, router]);

  function resetForm() {
    setTitle("");
    setBody("");
    setFile(null);
  }

  async function addFaqOrPaste(e) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const resolvedTitle =
      mode === "paste" ? (title.trim() || "Notes") : title.trim();
    try {
      await api(`/v1/agents/${id}/knowledge`, {
        method: "POST",
        body: JSON.stringify({ title: resolvedTitle, body }),
      });
      resetForm();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(e) {
    e.preventDefault();
    setError("");
    if (!file) {
      setError("Choose a PDF or DOCX file");
      return;
    }
    setSaving(true);
    try {
      const form = new FormData();
      form.append("file", file);
      if (title.trim()) form.append("title", title.trim());
      await api(`/v1/agents/${id}/knowledge/upload`, {
        method: "POST",
        body: form,
        timeoutMs: 60000,
      });
      resetForm();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(docId) {
    await api(`/v1/agents/${id}/knowledge/${docId}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <Nav />
      <main className="wrap">
        <h1>Knowledge</h1>
        <AgentTabs id={id} current="knowledge" />
        <p className="muted">
          Add FAQ pairs, paste notes, or upload PDF/DOCX files. Uploads are converted to text
          for the voice agent.
        </p>

        <div className="row" style={{ marginBottom: 12 }}>
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              className={mode === m.id ? "" : "secondary"}
              onClick={() => {
                setMode(m.id);
                setError("");
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === "upload" ? (
          <form className="card" onSubmit={uploadFile}>
            <label>Title (optional)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Defaults to the file name"
              maxLength={255}
            />
            <label>PDF or DOCX file</label>
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              required
            />
            <p className="muted" style={{ marginTop: 8 }}>
              Max 5 MB. Text is extracted and stored in the knowledge base (files are not kept).
            </p>
            {error ? <p className="error">{error}</p> : null}
            <div className="row" style={{ marginTop: 12 }}>
              <button type="submit" disabled={saving}>
                {saving ? "Uploading…" : "Upload & add"}
              </button>
            </div>
          </form>
        ) : (
          <form className="card" onSubmit={addFaqOrPaste}>
            <label>{mode === "paste" ? "Title (optional)" : "Title"}</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required={mode === "faq"}
              placeholder={mode === "paste" ? "Notes" : ""}
              maxLength={255}
            />
            <label>{mode === "paste" ? "Paste text" : "Answer / content"}</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              rows={mode === "paste" ? 12 : 6}
            />
            {error ? <p className="error">{error}</p> : null}
            <div className="row" style={{ marginTop: 12 }}>
              <button type="submit" disabled={saving}>
                {saving ? "Saving…" : mode === "paste" ? "Add text" : "Add FAQ"}
              </button>
            </div>
          </form>
        )}

        {docs.map((doc) => (
          <div className="card" key={doc.id}>
            <div className="item">
              <strong>{doc.title}</strong>
              <button className="danger" type="button" onClick={() => remove(doc.id)}>
                Delete
              </button>
            </div>
            <p className="muted">{doc.body}</p>
          </div>
        ))}
      </main>
    </>
  );
}
