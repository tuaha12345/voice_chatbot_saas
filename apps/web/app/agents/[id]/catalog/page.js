"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Nav from "../../../components/Nav";
import AgentTabs from "../tabs";
import { api, getToken } from "../../../../lib/api";

export default function CatalogPage() {
  const { id } = useParams();
  const router = useRouter();
  const [rows, setRows] = useState([]);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("0");
  const [error, setError] = useState("");

  function load() {
    api(`/v1/agents/${id}/products`)
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

  async function add(e) {
    e.preventDefault();
    setError("");
    try {
      await api(`/v1/agents/${id}/products`, {
        method: "POST",
        body: JSON.stringify({ name, sku, price: Number(price) || 0, active: true }),
      });
      setName("");
      setSku("");
      setPrice("0");
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function remove(pid) {
    await api(`/v1/agents/${id}/products/${pid}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <Nav />
      <main className="wrap">
        <h1>Catalog</h1>
        <AgentTabs id={id} current="catalog" />
        <p className="muted">Used when the orders module is on. Voice prefers these names and prices; custom items are still allowed.</p>
        <form className="card" onSubmit={add}>
          <label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
          <label>SKU (optional)</label>
          <input value={sku} onChange={(e) => setSku(e.target.value)} />
          <label>Price</label>
          <input type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
          {error ? <p className="error">{error}</p> : null}
          <div className="row" style={{ marginTop: 12 }}>
            <button type="submit">Add product</button>
          </div>
        </form>
        {rows.map((row) => (
          <div className="card item" key={row.id}>
            <div>
              <strong>{row.name}</strong>
              <div className="muted">
                {row.sku} · {row.price}
              </div>
            </div>
            <button className="danger" type="button" onClick={() => remove(row.id)}>
              Delete
            </button>
          </div>
        ))}
      </main>
    </>
  );
}
