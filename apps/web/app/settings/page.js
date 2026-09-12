"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../components/Nav";
import { api, getToken } from "../../lib/api";

export default function SettingsPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api("/v1/auth/me")
      .then((me) => setEmail(me.email || ""))
      .catch(() => router.replace("/login"));
  }, [router]);

  async function onSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      await api("/v1/me/password", {
        method: "POST",
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password updated successfully.");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Nav />
      <main className="wrap">
        <div className="page-header">
          <h1>Account settings</h1>
          <p className="muted">Manage your account security.</p>
        </div>
        <div className="card settings-card">
          <div className="settings-section">
            <h2>Profile</h2>
            <label>Email</label>
            <input value={email} readOnly disabled />
          </div>
          <form className="settings-section" onSubmit={onSubmit}>
            <h2>Change password</h2>
            <label>Current password</label>
            <input
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
            <label>New password</label>
            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
            />
            <label>Confirm new password</label>
            <input
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              type="password"
              autoComplete="new-password"
              minLength={6}
              required
            />
            {error ? <p className="error">{error}</p> : null}
            {success ? <p className="success">{success}</p> : null}
            <div className="row" style={{ marginTop: 16 }}>
              <button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Update password"}
              </button>
            </div>
          </form>
        </div>
      </main>
    </>
  );
}
