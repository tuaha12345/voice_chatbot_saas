"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Nav from "../../../components/Nav";
import AgentTabs from "../tabs";
import { api, getToken } from "../../../../lib/api";

export default function TicketsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  function load() {
    api(`/v1/agents/${id}/tickets`)
      .then(setRows)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    load();
  }, [id, router]);

  async function closeTicket(ticketId) {
    await api(`/v1/agents/${id}/tickets/${ticketId}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "closed" }),
    });
    load();
  }

  return (
    <>
      <Nav />
      <main className="wrap">
        <h1>Support tickets</h1>
        <AgentTabs id={id} current="tickets" />
        <p className="muted">Enable customer support in Settings. The voice agent files a ticket; a human follows up later.</p>
        {error ? <p className="error">{error}</p> : null}
        {rows.length === 0 ? <p className="muted">No tickets yet.</p> : null}
        {rows.map((row) => (
          <div className="card" key={row.id}>
            <div className="item">
              <strong>
                #{row.id} {row.subject}
              </strong>
              <span className="badge">{row.status}</span>
            </div>
            <p className="muted">
              {row.visitor_name} · {row.phone} · {row.email}
            </p>
            <p>{row.body}</p>
            {row.status === "open" ? (
              <button type="button" onClick={() => closeTicket(row.id)}>
                Close
              </button>
            ) : null}
          </div>
        ))}
      </main>
    </>
  );
}
