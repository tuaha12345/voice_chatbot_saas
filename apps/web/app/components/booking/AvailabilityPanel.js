"use client";

import { useEffect, useMemo, useState } from "react";
import { closeHourToTime, hourToTime, timeToCloseHour, timeToHour } from "./format";

const COMMON_ZONES = [
  "Asia/Dhaka",
  "Asia/Kolkata",
  "UTC",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
  "Asia/Dubai",
  "Asia/Singapore",
  "Australia/Sydney",
];

const WEEKDAYS = [
  { value: "1", label: "Mon" },
  { value: "2", label: "Tue" },
  { value: "3", label: "Wed" },
  { value: "4", label: "Thu" },
  { value: "5", label: "Fri" },
  { value: "6", label: "Sat" },
  { value: "7", label: "Sun" },
];

export default function AvailabilityPanel({ settings, onChange, onSave, saved, error, saving }) {
  const [open, setOpen] = useState(true);
  const selected = useMemo(
    () => new Set(String(settings.weekdays || "").split(",").map((s) => s.trim()).filter(Boolean)),
    [settings.weekdays]
  );

  const [customZone, setCustomZone] = useState(!COMMON_ZONES.includes(settings.timezone));

  useEffect(() => {
    setCustomZone(!COMMON_ZONES.includes(settings.timezone));
  }, [settings.timezone]);

  function toggleDay(day) {
    const next = new Set(selected);
    if (next.has(day)) next.delete(day);
    else next.add(day);
    const ordered = WEEKDAYS.map((d) => d.value).filter((v) => next.has(v));
    onChange({ ...settings, weekdays: ordered.join(",") });
  }

  return (
    <div className="card availability-panel">
      <div className="availability-head">
        <h2>Availability</h2>
        <button className="secondary" type="button" onClick={() => setOpen((v) => !v)}>
          {open ? "Hide" : "Show"}
        </button>
      </div>
      {open ? (
        <form onSubmit={onSave}>
          <label>Timezone</label>
          <select
            value={customZone ? "__custom__" : settings.timezone}
            onChange={(e) => {
              if (e.target.value === "__custom__") {
                setCustomZone(true);
                return;
              }
              setCustomZone(false);
              onChange({ ...settings, timezone: e.target.value });
            }}
          >
            {COMMON_ZONES.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
            <option value="__custom__">Custom…</option>
          </select>
          {customZone ? (
            <>
              <label>Custom timezone (IANA)</label>
              <input
                value={settings.timezone}
                onChange={(e) => onChange({ ...settings, timezone: e.target.value })}
                placeholder="Asia/Dhaka"
              />
            </>
          ) : null}

          <label>Weekdays</label>
          <div className="weekday-grid">
            {WEEKDAYS.map((d) => (
              <label key={d.value} className="check">
                <input type="checkbox" checked={selected.has(d.value)} onChange={() => toggleDay(d.value)} />
                {d.label}
              </label>
            ))}
          </div>

          <div className="settings-row">
            <div>
              <label>Open</label>
              <input
                type="time"
                value={hourToTime(settings.open_hour)}
                onChange={(e) => onChange({ ...settings, open_hour: timeToHour(e.target.value, 9) })}
              />
            </div>
            <div>
              <label>Close</label>
              <input
                type="time"
                value={closeHourToTime(settings.close_hour)}
                onChange={(e) => onChange({ ...settings, close_hour: timeToCloseHour(e.target.value, 17) })}
              />
            </div>
            <div>
              <label>Slot minutes</label>
              <input
                type="number"
                min={10}
                value={settings.slot_minutes}
                onChange={(e) => onChange({ ...settings, slot_minutes: e.target.value })}
              />
            </div>
          </div>

          <label>Max days ahead</label>
          <input
            type="number"
            min={1}
            value={settings.max_days_ahead}
            onChange={(e) => onChange({ ...settings, max_days_ahead: e.target.value })}
          />

          {saved ? <p className="muted">Saved.</p> : null}
          {error ? <p className="error">{error}</p> : null}
          <div className="row" style={{ marginTop: 12 }}>
            <button type="submit" disabled={saving}>
              {saving ? "Saving…" : "Save hours"}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
