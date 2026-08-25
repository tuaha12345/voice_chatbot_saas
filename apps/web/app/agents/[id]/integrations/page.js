"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Nav from "../../../components/Nav";
import AgentTabs from "../tabs";
import { api, getToken } from "../../../../lib/api";

export default function IntegrationsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [hook, setHook] = useState({ url: "", secret: "" });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api(`/v1/agents/${id}/webhook`)
      .then(setHook)
      .catch((err) => setError(err.message));
  }, [id, router]);

  async function save(e) {
    e.preventDefault();
    setError("");
    setSaved(false);
    try {
      const next = await api(`/v1/agents/${id}/webhook`, {
        method: "PUT",
        body: JSON.stringify({ url: hook.url }),
      });
      setHook(next);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    }
  }

  async function rotate() {
    const next = await api(`/v1/agents/${id}/webhook/rotate`, { method: "POST" });
    setHook(next);
  }

  return (
    <>
      <Nav />
      <main className="wrap">
        <h1>Integrations</h1>
        <AgentTabs id={id} current="integrations" />
        <div className="card">
          <p className="muted">
            Outbound webhook fires on booking.created, order.created, and ticket.created. Header{" "}
            <code>X-Webhook-Secret</code>. SMTP is configured on the server (.env), not per agent.
          </p>
          <form onSubmit={save}>
            <label>Webhook URL</label>
            <input
              value={hook.url || ""}
              onChange={(e) => setHook({ ...hook, url: e.target.value })}
              placeholder="https://example.com/hooks/voice"
            />
            <label>Webhook secret</label>
            <pre>{hook.secret || ""}</pre>
            {error ? <p className="error">{error}</p> : null}
            {saved ? <p className="muted">Saved.</p> : null}
            <div className="row" style={{ marginTop: 12 }}>
              <button type="submit">Save URL</button>
              <button className="secondary" type="button" onClick={rotate}>
                Rotate secret
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
