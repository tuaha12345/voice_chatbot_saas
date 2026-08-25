"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Views } from "react-big-calendar";
import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from "date-fns";
import "react-big-calendar/lib/css/react-big-calendar.css";

import Nav from "../../../components/Nav";
import AgentTabs from "../tabs";
import { api, getToken } from "../../../../lib/api";
import BookingCalendar from "../../../components/booking/BookingCalendar";
import AvailabilityPanel from "../../../components/booking/AvailabilityPanel";
import BookingDetailModal from "../../../components/booking/BookingDetailModal";
import CreateBookingModal from "../../../components/booking/CreateBookingModal";
import { toDateParam, parseBookingDate } from "../../../components/booking/format";

const emptySettings = {
  timezone: "Asia/Dhaka",
  slot_minutes: 30,
  open_hour: 9,
  close_hour: 17,
  weekdays: "1,2,3,4,5",
  max_days_ahead: 14,
};

function rangeFor(view, date) {
  if (view === Views.MONTH) {
    return {
      start: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(date), { weekStartsOn: 1 }),
    };
  }
  return {
    start: startOfWeek(date, { weekStartsOn: 1 }),
    end: endOfWeek(date, { weekStartsOn: 1 }),
  };
}

export default function BookingsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [settings, setSettings] = useState(emptySettings);
  const [rows, setRows] = useState([]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [error, setError] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState(Views.WEEK);
  const [date, setDate] = useState(() => new Date());
  const [range, setRange] = useState(() => rangeFor(Views.WEEK, new Date()));
  const [selected, setSelected] = useState(null);
  const [createStart, setCreateStart] = useState(null);
  const [createError, setCreateError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const loadCalendar = useCallback(
    async (r) => {
      const from = toDateParam(r.start);
      const to = toDateParam(r.end);
      const [list, slotsRes] = await Promise.all([
        api(`/v1/agents/${id}/bookings?from=${from}&to=${to}`),
        api(`/v1/agents/${id}/bookings/slots?from=${from}&to=${to}`),
      ]);
      setRows(list);
      setAvailableSlots(slotsRes.slots || []);
    },
    [id]
  );

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    api(`/v1/agents/${id}/bookings/settings`)
      .then(setSettings)
      .catch((err) => setError(err.message));
  }, [id, router]);

  useEffect(() => {
    if (!getToken()) return;
    loadCalendar(range).catch((err) => setError(err.message));
  }, [range, loadCalendar]);

  async function saveSettings(e) {
    e.preventDefault();
    setSettingsError("");
    setSaved(false);
    setSaving(true);
    try {
      const next = await api(`/v1/agents/${id}/bookings/settings`, {
        method: "PUT",
        body: JSON.stringify({
          ...settings,
          slot_minutes: Number(settings.slot_minutes),
          open_hour: Number(settings.open_hour),
          close_hour: Number(settings.close_hour),
          max_days_ahead: Number(settings.max_days_ahead),
        }),
      });
      setSettings(next);
      setSaved(true);
      await loadCalendar(range);
    } catch (err) {
      setSettingsError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function cancelBooking(bookingId) {
    setCancelling(true);
    setError("");
    try {
      await api(`/v1/agents/${id}/bookings/${bookingId}/cancel`, { method: "POST" });
      setSelected(null);
      await loadCalendar(range);
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelling(false);
    }
  }

  async function createBooking(body) {
    setSubmitting(true);
    setCreateError("");
    try {
      await api(`/v1/agents/${id}/bookings`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setCreateStart(null);
      await loadCalendar(range);
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleRangeChange(next) {
    if (!next?.start || !next?.end) return;
    setRange({ start: next.start, end: next.end });
  }

  function handleView(nextView) {
    setView(nextView);
    const nextRange = rangeFor(nextView, date);
    setRange(nextRange);
  }

  function handleNavigate(nextDate) {
    setDate(nextDate);
    setRange(rangeFor(view, nextDate));
  }

  return (
    <>
      <Nav />
      <main className="wrap booking-page">
        <h1>Bookings</h1>
        <AgentTabs id={id} current="bookings" />
        <p className="muted">Manage availability and view bookings on the calendar.</p>
        {error ? <p className="error">{error}</p> : null}

        <div className="booking-layout">
          <BookingCalendar
            bookings={rows}
            availableSlots={availableSlots}
            view={view}
            onView={handleView}
            date={date}
            onNavigate={handleNavigate}
            onRangeChange={handleRangeChange}
            onSelectEvent={(event) => {
              if (event.resource?.kind === "available-day") {
                const day = parseBookingDate(event.resource.day || event.start);
                setDate(day);
                setView(Views.WEEK);
                setRange(rangeFor(Views.WEEK, day));
                return;
              }
              if (event.resource?.kind === "available") {
                setCreateError("");
                setCreateStart(event.start);
                return;
              }
              setSelected(event.resource?.data || event.resource);
            }}
            onSelectSlot={({ start, action }) => {
              if (action === "select" || action === "click") {
                setCreateError("");
                setCreateStart(start);
              }
            }}
          />
          <AvailabilityPanel
            settings={settings}
            onChange={setSettings}
            onSave={saveSettings}
            saved={saved}
            error={settingsError}
            saving={saving}
          />
        </div>
      </main>

      <BookingDetailModal
        booking={selected}
        timezone={settings.timezone}
        onClose={() => setSelected(null)}
        onCancel={cancelBooking}
        cancelling={cancelling}
      />
      <CreateBookingModal
        slotStart={createStart}
        timezone={settings.timezone}
        slotMinutes={settings.slot_minutes}
        onClose={() => setCreateStart(null)}
        onSubmit={createBooking}
        submitting={submitting}
        error={createError}
      />
    </>
  );
}
