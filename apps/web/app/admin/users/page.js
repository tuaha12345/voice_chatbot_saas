"use client";

import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [edits, setEdits] = useState({});
  const [meId, setMeId] = useState(null);

  useEffect(() => {
    api("/v1/auth/me")
      .then((me) => setMeId(me.id))
      .catch(() => setMeId(null));
    api("/v1/admin/users")
      .then((rows) => {
        setUsers(rows);
        const next = {};
        rows.forEach((u) => {
          next[u.id] = {
            email: u.email,
            password: "",
            plan_minutes: u.plan_minutes ?? 120,
            is_admin: u.is_admin,
          };
        });
        setEdits(next);
      })
      .catch((err) => setError(err.message));
  }, []);

  async function saveUser(id) {
    setError("");
    const patch = edits[id];
    const body = {
      email: patch.email,
      plan_minutes: Number(patch.plan_minutes),
      is_admin: patch.is_admin,
    };
    if (patch.password && patch.password.length >= 6) {
      body.password = patch.password;
    }
    try {
      const updated = await api(`/v1/admin/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
      setEdits((prev) => ({
        ...prev,
        [id]: {
          email: updated.email,
          password: "",
          plan_minutes: updated.plan_minutes ?? 120,
          is_admin: updated.is_admin,
        },
      }));
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteUser(id, email) {
    if (!window.confirm(`Delete user ${email}? All their agents will also be deleted.`)) {
      return;
    }
    setError("");
    try {
      await api(`/v1/admin/users/${id}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== id));
      setEdits((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <h1>Users</h1>
      <p className="muted">Edit email, password, plan minutes, admin access — or delete accounts.</p>
      {error ? <p className="error">{error}</p> : null}
      <div className="list">
        {users.map((user) => (
          <div className="card" key={user.id}>
            <div className="item">
              <div>
                <strong>{user.email}</strong>
                <div className="muted">
                  {user.agent_count} agents · {user.used_minutes} min used this month · $
                  {Number(user.cost_usd_month || 0).toFixed(4)} est. cost
                </div>
              </div>
              <span className="badge">{user.is_admin ? "admin" : "tenant"}</span>
            </div>
            <label>Email</label>
            <input
              type="email"
              value={edits[user.id]?.email ?? ""}
              onChange={(e) =>
                setEdits((prev) => ({
                  ...prev,
                  [user.id]: { ...prev[user.id], email: e.target.value },
                }))
              }
            />
            <label>New password (optional)</label>
            <input
              type="password"
              minLength={6}
              placeholder="Leave blank to keep current"
              value={edits[user.id]?.password ?? ""}
              onChange={(e) =>
                setEdits((prev) => ({
                  ...prev,
                  [user.id]: { ...prev[user.id], password: e.target.value },
                }))
              }
            />
            <div className="row" style={{ marginTop: 12 }}>
              <label style={{ margin: 0 }}>
                Plan minutes
                <input
                  type="number"
                  min={0}
                  value={edits[user.id]?.plan_minutes ?? 120}
                  onChange={(e) =>
                    setEdits((prev) => ({
                      ...prev,
                      [user.id]: { ...prev[user.id], plan_minutes: e.target.value },
                    }))
                  }
                  style={{ width: 120, marginTop: 6 }}
                />
              </label>
              <label style={{ display: "flex", gap: 8, alignItems: "center", margin: 0 }}>
                <input
                  type="checkbox"
                  checked={Boolean(edits[user.id]?.is_admin)}
                  onChange={(e) =>
                    setEdits((prev) => ({
                      ...prev,
                      [user.id]: { ...prev[user.id], is_admin: e.target.checked },
                    }))
                  }
                />
                Admin
              </label>
              <button type="button" onClick={() => saveUser(user.id)}>
                Edit
              </button>
              <button
                type="button"
                className="danger"
                disabled={user.id === meId}
                onClick={() => deleteUser(user.id, user.email)}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
