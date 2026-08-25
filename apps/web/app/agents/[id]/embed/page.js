"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Nav from "../../../components/Nav";
import AgentTabs from "../tabs";
import { API, api, getToken } from "../../../../lib/api";

export default function EmbedPage() {
  const { id } = useParams();
  const router = useRouter();
  const [embed, setEmbed] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api(`/v1/agents/${id}/embed`)
      .then(setEmbed)
      .catch((err) => setError(err.message));
  }, [id, router]);

  return (
    <>
      <Nav />
      <main className="wrap">
        <h1>Embed</h1>
        <AgentTabs id={id} current="embed" />
        {error ? <p className="error">{error}</p> : null}
        {embed ? (
          <div className="card">
            <p className="muted">Paste this on WordPress or any HTML site. HTTPS is required for the microphone.</p>
            <label>Script snippet</label>
            <pre>{embed.script}</pre>
            <p className="muted">{embed.wordpress}</p>
            <p>
              Demo page:{" "}
              <a href={`${API}/demo`} target="_blank" rel="noreferrer">
                {API}/demo
              </a>{" "}
              (paste key <code>{embed.public_key}</code>)
            </p>
          </div>
        ) : (
          <p>Loading…</p>
        )}
      </main>
    </>
  );
}
