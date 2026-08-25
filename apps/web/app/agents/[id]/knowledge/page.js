"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Nav from "../../../components/Nav";
import AgentTabs from "../tabs";
import { api, getToken } from "../../../../lib/api";

export default function KnowledgePage() {
  const { id } = useParams();
  const router = useRouter();
  const [docs, setDocs] = useState([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

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

  async function addDoc(e) {
    e.preventDefault();
    setError("");
    try {
      await api(`/v1/agents/${id}/knowledge`, {
        method: "POST",
        body: JSON.stringify({ title, body }),
      });
      setTitle("");
      setBody("");
      load();
    } catch (err) {
      setError(err.message);
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
        <h1>Q&A knowledge</h1>
        <AgentTabs id={id} current="knowledge" />
        <form className="card" onSubmit={addDoc}>
          <label>Title</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required />
          <label>Answer / content</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} required />
          {error ? <p className="error">{error}</p> : null}
          <div className="row" style={{ marginTop: 12 }}>
            <button type="submit">Add FAQ</button>
          </div>
        </form>
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
