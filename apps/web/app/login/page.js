"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../components/Nav";
import { api, setToken } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    try {
      const data = await api("/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(data.access_token);
      const me = await api("/v1/auth/me");
      router.push(me.is_admin ? "/admin" : "/dashboard");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <Nav />
      <main className="wrap">
        <div className="card" style={{ maxWidth: 420, margin: "40px auto" }}>
          <h1>Log in</h1>
          <form onSubmit={onSubmit}>
            <label>Email</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
            <label>Password</label>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required />
            {error ? <p className="error">{error}</p> : null}
            <div className="row" style={{ marginTop: 16 }}>
              <button type="submit">Log in</button>
            </div>
          </form>
          <p className="muted" style={{ marginTop: 16 }}>
            Dev platform admin: <code>admin@example.com</code>
          </p>
        </div>
      </main>
    </>
  );
}
