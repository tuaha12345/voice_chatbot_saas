"use client";

import Link from "next/link";

export default function AgentTabs({ id, current }) {
  const items = [
    ["settings", "Settings", `/agents/${id}`],
    ["knowledge", "Knowledge", `/agents/${id}/knowledge`],
    ["bookings", "Bookings", `/agents/${id}/bookings`],
    ["orders", "Orders", `/agents/${id}/orders`],
    ["catalog", "Catalog", `/agents/${id}/catalog`],
    ["tickets", "Support", `/agents/${id}/tickets`],
    ["integrations", "Integrations", `/agents/${id}/integrations`],
    ["pages", "Site pages", `/agents/${id}/pages`],
    ["embed", "Embed", `/agents/${id}/embed`],
    ["conversations", "Transcripts", `/agents/${id}/conversations`],
  ];
  return (
    <nav className="tabs">
      {items.map(([key, label, href]) => (
        <Link key={key} className={current === key ? "active" : ""} href={href}>
          {label}
        </Link>
      ))}
    </nav>
  );
}
