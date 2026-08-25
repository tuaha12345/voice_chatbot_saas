"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Nav from "../../../components/Nav";
import AgentTabs from "../tabs";
import { api, getToken } from "../../../../lib/api";

export default function ConversationsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api(`/v1/agents/${id}/conversations`)
      .then(setRows)
      .catch((err) => setError(err.message));
  }, [id, router]);

  return (
    <>
      <Nav />
      <main className="wrap">
        <h1>Transcripts</h1>
        <AgentTabs id={id} current="conversations" />
        {error ? <p className="error">{error}</p> : null}
        {rows.length === 0 ? <p className="muted">No conversations yet.</p> : null}
        {rows.map((row) => (
          <div className="card" key={row.id}>
            <div className="muted">
              {row.room_name} · {row.started_at}
            </div>
            {(row.messages || []).map((msg) => (
              <p key={msg.id}>
                <span className="badge">{msg.role}</span> {msg.content}
              </p>
            ))}
          </div>
        ))}
      </main>
    </>
  );
}
