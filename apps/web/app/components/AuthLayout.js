import Link from "next/link";

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-shell">
      <aside className="auth-hero">
        <div className="auth-hero-inner">
          <Link href="/" className="auth-logo">
            Voice Chat SaaS
          </Link>
          <h1>Embeddable voice agents for your business</h1>
          <p>
            Deploy AI voice assistants on your website, manage knowledge, bookings, orders, and
            support — all from one dashboard.
          </p>
          <ul className="auth-features">
            <li>Real-time voice conversations</li>
            <li>FAQ knowledge base</li>
            <li>Meeting booking &amp; orders</li>
            <li>Embeddable widget for any site</li>
          </ul>
        </div>
      </aside>
      <main className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-head">
            <h2>{title}</h2>
            {subtitle ? <p className="muted">{subtitle}</p> : null}
          </div>
          {children}
          {footer ? <div className="auth-card-foot">{footer}</div> : null}
        </div>
      </main>
    </div>
  );
}
