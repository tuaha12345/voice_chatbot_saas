"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { clearToken } from "../../lib/api";
import { useAdminGuard } from "../../lib/useAdminGuard";

const NAV = [
  { href: "/admin", label: "Overview", match: (p) => p === "/admin" },
  { href: "/admin/users", label: "Users", match: (p) => p.startsWith("/admin/users") },
  { href: "/admin/agents", label: "Agents", match: (p) => p.startsWith("/admin/agents") },
  { href: "/admin/usage", label: "Usage", match: (p) => p.startsWith("/admin/usage") },
];

export default function AdminShell({ children }) {
  const pathname = usePathname();
  const router = useRouter();
  const { ready, user } = useAdminGuard();

  function logout() {
    clearToken();
    router.push("/login");
  }

  if (!ready) {
    return <p className="wrap muted">Loading admin…</p>;
  }

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-brand">Platform Admin</div>
        <nav className="admin-side-nav">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={item.match(pathname) ? "active" : ""}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="admin-side-footer">
          <button type="button" className="secondary" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <span className="muted">{user?.email || ""}</span>
        </header>
        <div className="admin-content">{children}</div>
      </div>
    </div>
  );
}
