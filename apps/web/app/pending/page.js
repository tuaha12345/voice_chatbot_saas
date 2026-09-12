"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AuthLayout from "../components/AuthLayout";
import { api, clearToken, getToken } from "../../lib/api";
import { homePathForUser, isServiceAllowed } from "../../lib/authRedirect";

export default function PendingPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api("/v1/auth/me")
      .then((me) => {
        if (isServiceAllowed(me)) {
          router.replace(homePathForUser(me));
          return;
        }
        setEmail(me.email || "");
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  function logout() {
    clearToken();
    router.replace("/login");
  }

  return (
    <AuthLayout
      title="Waiting for approval"
      subtitle="Your account was created. An admin must approve it before you can use agents and the voice widget."
      footer={
        <p className="muted">
          Wrong account?{" "}
          <button type="button" className="linkish" onClick={logout} style={{ background: "none", border: 0, color: "inherit", textDecoration: "underline", cursor: "pointer", padding: 0 }}>
            Sign out
          </button>
          {" · "}
          <Link href="/settings">Change password</Link>
        </p>
      }
    >
      <div className="auth-form">
        {email ? <p>Signed in as <strong>{email}</strong></p> : null}
        <p className="muted">
          You can refresh this page after an admin approves you. No voice minutes or agents are available until then.
        </p>
        <button
          type="button"
          className="auth-submit"
          onClick={() => {
            api("/v1/auth/me")
              .then((me) => router.replace(homePathForUser(me)))
              .catch(() => router.replace("/login"));
          }}
        >
          Check approval status
        </button>
      </div>
    </AuthLayout>
  );
}
