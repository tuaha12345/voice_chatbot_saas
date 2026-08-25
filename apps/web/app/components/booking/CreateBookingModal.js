"use client";

import { useEffect, useState } from "react";
import { formatInZone, toSlotString } from "./format";

const emptyForm = {
  guest_name: "",
  guest_phone: "",
  guest_email: "",
  notes: "",
};

export default function CreateBookingModal({ slotStart, timezone, slotMinutes, onClose, onSubmit, submitting, error }) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    setForm(emptyForm);
  }, [slotStart]);

  if (!slotStart) return null;

  const ends = new Date(slotStart.getTime() + (Number(slotMinutes) || 30) * 60 * 1000);

  async function handleSubmit(e) {
    e.preventDefault();
    await onSubmit({
      guest_name: form.guest_name,
      guest_phone: form.guest_phone,
      guest_email: form.guest_email,
      notes: form.notes,
      starts_at: toSlotString(slotStart),
    });
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div className="modal-card card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>New booking</h2>
          <button className="secondary" type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <p className="muted">
          {formatInZone(slotStart, timezone)} – {formatInZone(ends, timezone, { timeStyle: "short" })}
        </p>
        <form onSubmit={handleSubmit}>
          <label>Guest name</label>
          <input
            required
            value={form.guest_name}
            onChange={(e) => setForm({ ...form, guest_name: e.target.value })}
            placeholder="Name"
          />
          <label>Phone</label>
          <input
            value={form.guest_phone}
            onChange={(e) => setForm({ ...form, guest_phone: e.target.value })}
            placeholder="Optional"
          />
          <label>Email</label>
          <input
            type="email"
            value={form.guest_email}
            onChange={(e) => setForm({ ...form, guest_email: e.target.value })}
            placeholder="Optional"
          />
          <label>Notes</label>
          <textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Optional"
          />
          {error ? <p className="error">{error}</p> : null}
          <div className="row" style={{ marginTop: 12 }}>
            <button type="submit" disabled={submitting}>
              {submitting ? "Creating…" : "Create booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
