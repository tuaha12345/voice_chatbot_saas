"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken, getToken, api } from "../../lib/api";
import { useEffect, useState } from "react";

function initials(email) {
  if (!email) return "?";
  const local = String(email).split("@")[0] || "?";
  const parts = local.replace(/[._-]+/g, " ").trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return local.slice(0, 2).toUpperCase();
}

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthed(false);
      setIsAdmin(false);
      setEmail("");
      setLoading(false);
      return;
    }
    setLoading(true);
    api("/v1/auth/me")
      .then((me) => {
        setAuthed(true);
        setIsAdmin(Boolean(me.is_admin));
        setEmail(me.email || "");
      })
      .catch(() => {
        clearToken();
        setAuthed(false);
        setIsAdmin(false);
        setEmail("");
      })
      .finally(() => setLoading(false));
  }, [pathname]);

  function logout() {
    clearToken();
    setAuthed(false);
    setIsAdmin(false);
    setEmail("");
    router.push("/login");
  }

  return (
    <header className="nav">
      <Link className="brand" href={authed ? (isAdmin ? "/admin" : "/dashboard") : "/login"}>
        Voice Chat SaaS
      </Link>
      {loading ? (
        <span className="nav-loading muted">…</span>
      ) : authed ? (
        <div className="row nav-user">
          {isAdmin ? <Link href="/admin">Admin</Link> : null}
          <Link href="/settings">Settings</Link>
          {!isAdmin && email ? (
            <div className="nav-identity" title={email}>
              <span className="nav-avatar">{initials(email)}</span>
              <span className="nav-email">{email}</span>
            </div>
          ) : null}
          <button type="button" className="secondary" onClick={logout}>
            Log out
          </button>
        </div>
      ) : (
        <div className="row nav-guest">
          <Link href="/login" className={pathname === "/login" ? "nav-link-active" : ""}>
            Log in
          </Link>
          <Link href="/register" className="btn btn-sm">
            Get started
          </Link>
        </div>
      )}
    </header>
  );
}
