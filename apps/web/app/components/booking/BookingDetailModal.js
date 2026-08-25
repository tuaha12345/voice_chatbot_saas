"use client";

import { formatInZone } from "./format";

export default function BookingDetailModal({ booking, timezone, onClose, onCancel, cancelling }) {
  if (!booking) return null;

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-card card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>Booking</h2>
          <button className="secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <p>
          <strong>{booking.guest_name}</strong>
        </p>
        <p className="muted">
          {formatInZone(booking.starts_at, timezone)} –{" "}
          {formatInZone(booking.ends_at, timezone, { timeStyle: "short" })}
        </p>
        <p className="muted">
          {booking.guest_phone || "—"} · {booking.guest_email || "—"}
        </p>
        {booking.notes ? <p>{booking.notes}</p> : null}
        <p>
          <span className="badge">{booking.status}</span>
        </p>
        {booking.status === "confirmed" ? (
          <div className="row" style={{ marginTop: 16 }}>
            <button className="danger" type="button" disabled={cancelling} onClick={() => onCancel(booking.id)}>
              {cancelling ? "Cancelling…" : "Cancel booking"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
