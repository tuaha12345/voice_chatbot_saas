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
  const [authed, setAuthed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const hasToken = Boolean(getToken());
    setAuthed(hasToken);
    if (!hasToken) {
      setIsAdmin(false);
      setEmail("");
      return;
    }
    api("/v1/auth/me")
      .then((me) => {
        setIsAdmin(Boolean(me.is_admin));
        setEmail(me.email || "");
      })
      .catch(() => {
        setIsAdmin(false);
        setEmail("");
      });
  }, [pathname]);

  function logout() {
    clearToken();
    router.push("/login");
  }

  return (
    <header className="nav">
      <Link className="brand" href={isAdmin ? "/admin" : "/dashboard"}>
        Voice Chat SaaS
      </Link>
      {authed ? (
        <div className="row nav-user">
          {isAdmin ? <Link href="/admin">Admin</Link> : null}
          {!isAdmin && email ? (
            <div className="nav-identity" title={email}>
              <span className="nav-avatar">{initials(email)}</span>
              <span className="nav-email">{email}</span>
            </div>
          ) : null}
          <button className="secondary" onClick={logout}>
            Log out
          </button>
        </div>
      ) : (
        <div className="row">
          <Link href="/login">Log in</Link>
          <Link href="/register">Register</Link>
        </div>
      )}
    </header>
  );
}
