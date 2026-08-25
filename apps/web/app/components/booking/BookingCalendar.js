"use client";

import { useMemo, useCallback } from "react";
import { Calendar, dateFnsLocalizer, Views } from "react-big-calendar";
import { format, parse, startOfWeek, getDay, startOfDay } from "date-fns";
import { enUS } from "date-fns/locale";
import { parseBookingDate } from "./format";

const locales = { "en-US": enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }),
  getDay,
  locales,
});

function formatSlotTime(date) {
  return format(date, "h:mm a");
}

function groupSlotsByDay(slots) {
  const byDay = new Map();
  for (const slot of slots) {
    const day = String(slot.starts_at).slice(0, 10);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(slot);
  }
  return byDay;
}

export default function BookingCalendar({
  bookings = [],
  availableSlots = [],
  view,
  onView,
  date,
  onNavigate,
  onRangeChange,
  onSelectEvent,
  onSelectSlot,
}) {
  const isMonth = view === Views.MONTH;

  const events = useMemo(() => {
    const booked = bookings.map((b) => ({
      id: `booked-${b.id}`,
      title: b.guest_name || "Booking",
      start: parseBookingDate(b.starts_at),
      end: parseBookingDate(b.ends_at),
      resource: { kind: "booked", data: b },
    }));

    let open = [];
    if (isMonth) {
      const byDay = groupSlotsByDay(availableSlots);
      open = [...byDay.entries()].map(([day, slots]) => ({
        id: `avail-day-${day}`,
        title: `Available · ${slots.length} slot${slots.length === 1 ? "" : "s"}`,
        start: startOfDay(parseBookingDate(day)),
        end: startOfDay(parseBookingDate(day)),
        allDay: true,
        resource: { kind: "available-day", data: slots, day },
      }));
    } else {
      open = availableSlots.map((s) => {
        const start = parseBookingDate(s.starts_at);
        const end = parseBookingDate(s.ends_at);
        return {
          id: `avail-${s.starts_at}`,
          title: `Available · ${formatSlotTime(start)}`,
          start,
          end,
          resource: { kind: "available", data: s },
        };
      });
    }

    return [...open, ...booked];
  }, [bookings, availableSlots, isMonth]);

  const eventPropGetter = useCallback((event) => {
    const kind = event.resource?.kind;
    if (kind === "available" || kind === "available-day") {
      return { className: "booking-event available" };
    }
    if (event.resource?.data?.status === "cancelled") {
      return { className: "booking-event cancelled" };
    }
    return { className: "booking-event booked" };
  }, []);

  const handleRangeChange = useCallback(
    (range) => {
      if (!onRangeChange) return;
      if (Array.isArray(range)) {
        onRangeChange({ start: range[0], end: range[range.length - 1] });
        return;
      }
      if (range?.start && range?.end) {
        onRangeChange({ start: range.start, end: range.end });
      }
    },
    [onRangeChange]
  );

  return (
    <div className="booking-calendar card">
      <div className="booking-legend">
        <span className="booking-legend-item">
          <span className="booking-legend-swatch available" aria-hidden="true" />
          Available
        </span>
        <span className="booking-legend-item">
          <span className="booking-legend-swatch booked" aria-hidden="true" />
          Booked
        </span>
        <span className="booking-legend-item">
          <span className="booking-legend-swatch cancelled" aria-hidden="true" />
          Cancelled
        </span>
      </div>
      <Calendar
        localizer={localizer}
        events={events}
        view={view}
        onView={onView}
        date={date}
        onNavigate={onNavigate}
        onRangeChange={handleRangeChange}
        views={[Views.WEEK, Views.MONTH]}
        defaultView={Views.WEEK}
        selectable
        popup
        step={30}
        timeslots={2}
        onSelectEvent={onSelectEvent}
        onSelectSlot={onSelectSlot}
        eventPropGetter={eventPropGetter}
        style={{ minHeight: 560 }}
      />
    </div>
  );
}
