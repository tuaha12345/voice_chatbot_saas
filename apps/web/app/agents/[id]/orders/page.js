"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Nav from "../../../components/Nav";
import AgentTabs from "../tabs";
import { api, getToken } from "../../../../lib/api";

export default function OrdersPage() {
  const { id } = useParams();
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");

  function load() {
    api(`/v1/agents/${id}/orders`)
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

  async function setStatus(orderId, status) {
    await api(`/v1/agents/${id}/orders/${orderId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    load();
  }

  return (
    <>
      <Nav />
      <main className="wrap">
        <h1>Orders</h1>
        <AgentTabs id={id} current="orders" />
        <p className="muted">Enable the orders module in Settings. The voice agent collects name, phone, address, and items.</p>
        {error ? <p className="error">{error}</p> : null}
        {rows.length === 0 ? <p className="muted">No orders yet.</p> : null}
        {rows.map((row) => (
          <div className="card" key={row.id}>
            <div className="item">
              <strong>
                #{row.id} {row.customer_name}
              </strong>
              <span className="badge">{row.status}</span>
            </div>
            <p className="muted">
              {row.phone} · {row.address}
            </p>
            <pre>{row.items}</pre>
            {row.notes ? <p className="muted">{row.notes}</p> : null}
            <div className="row">
              <button className="secondary" type="button" onClick={() => setStatus(row.id, "confirmed")}>
                Mark confirmed
              </button>
              <button className="secondary" type="button" onClick={() => setStatus(row.id, "new")}>
                Mark new
              </button>
            </div>
          </div>
        ))}
      </main>
    </>
  );
}
