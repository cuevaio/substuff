"use client";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  List,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { connectionQuery } from "@/components/buffer-panel";
import { Dialog } from "@/components/dialog";
import { Button } from "@/components/ui/button";
import { activeDelivery, dateKey, monthDays } from "@/lib/calendar";

type Item = {
  id: string;
  articleId: string;
  noteId: string;
  text: string;
  status: string;
  dueAt: string | null;
  createdAt: string;
  title: string;
  channelId: string;
  bufferPostId: string | null;
  error: string | null;
};
const labels: Record<string, string> = {
  sent: "Published",
  scheduled: "Scheduled",
  draft: "Draft",
  sending: "Publishing",
  creating: "Confirming",
  unknown: "Check Buffer",
  error: "Needs attention",
  needs_approval: "Awaiting approval",
};
export function SchedulePage({ view }: { view: "list" | "calendar" }) {
  const client = useQueryClient();
  const connection = useQuery(connectionQuery);
  const [zone, setZone] = useState("UTC");
  const initializedZone = useRef(false);
  const [month, setMonth] = useState(() => {
    const key = dateKey(new Date(), zone);
    return {
      year: Number(key.slice(0, 4)),
      month: Number(key.slice(5, 7)) - 1,
    };
  });
  useEffect(() => {
    const nextZone =
      connection.data?.channels?.[0]?.timezone ||
      Intl.DateTimeFormat().resolvedOptions().timeZone;
    setZone(nextZone);
    if (!initializedZone.current && connection.data) {
      const key = dateKey(new Date(), nextZone);
      setMonth({
        year: Number(key.slice(0, 4)),
        month: Number(key.slice(5, 7)) - 1,
      });
      initializedZone.current = true;
    }
  }, [connection.data]);
  const [selected, setSelected] = useState<Item | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const query = useInfiniteQuery({
    queryKey: ["schedule"],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const response = await fetch(`/api/schedule?cursor=${pageParam}`);
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Couldn’t load your schedule.");
      return data as { items: Item[]; nextCursor: number | null };
    },
    getNextPageParam: (page) => page.nextCursor ?? undefined,
  });
  const items = Array.from(
    new Map(
      (query.data?.pages.flatMap((page) => page.items) || []).map((item) => [
        item.id,
        item,
      ]),
    ).values(),
  ).filter((item) => activeDelivery(item.status));
  const dated = items
    .filter((item): item is Item & { dueAt: string } => Boolean(item.dueAt))
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const unscheduled = items.filter((item) => !item.dueAt);
  const days = monthDays(month.year, month.month);
  const today = dateKey(new Date(), zone);
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/buffer/deliveries?sync=true");
      const data = await response.json();
      if (!response.ok || data.warning)
        throw new Error(
          data.error || data.warning || "Couldn’t refresh statuses.",
        );
      await client.invalidateQueries({ queryKey: ["schedule"] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t refresh.");
    } finally {
      setBusy(false);
    }
  }
  const card = (item: Item) => (
    <button
      type="button"
      key={item.id}
      className={`schedule-item status-${item.status}`}
      onClick={() => setSelected(item)}
    >
      <span>
        <time>
          {item.dueAt
            ? new Intl.DateTimeFormat(undefined, {
                timeZone: zone,
                hour: "numeric",
                minute: "2-digit",
              }).format(new Date(item.dueAt))
            : "No date"}
        </time>
        <small>{labels[item.status] || item.status}</small>
      </span>
      <p>{item.text}</p>
      <small>{item.title}</small>
    </button>
  );
  function shift(delta: number) {
    const next = new Date(Date.UTC(month.year, month.month + delta, 1));
    setMonth({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  }
  return (
    <main id="main" className="page-content schedule-page">
      <header className="schedule-heading">
        <h1>Schedule</h1>
        <div className="view-switch">
          <Link
            href="/schedule?view=list"
            aria-current={view === "list" ? "page" : undefined}
          >
            <List size={15} />
            List
          </Link>
          <Link
            href="/schedule?view=calendar"
            aria-current={view === "calendar" ? "page" : undefined}
          >
            <CalendarDays size={15} />
            Calendar
          </Link>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Refresh schedule"
          disabled={busy}
          onClick={() => void refresh()}
        >
          <RefreshCw size={16} />
        </button>
      </header>
      <p className="input-caption">
        Notes sent through substuff · {zone} · last confirmed Buffer status
      </p>
      {(error || query.error) && (
        <p className="inline-error" role="alert">
          {error || query.error?.message}
        </p>
      )}
      {query.isPending && <p role="status">Loading your schedule…</p>}
      {query.hasNextPage && (
        <div className="schedule-more">
          <p>More history is available. Load it to complete this view.</p>
          <Button
            variant="secondary"
            onClick={() => void query.fetchNextPage()}
            disabled={query.isFetchingNextPage}
          >
            Load more Notes
          </Button>
        </div>
      )}
      {view === "calendar" ? (
        <>
          <div className="calendar-navigation">
            <button
              type="button"
              className="icon-button"
              aria-label="Previous month"
              onClick={() => shift(-1)}
            >
              <ChevronLeft size={17} />
            </button>
            <h2>
              {new Intl.DateTimeFormat(undefined, {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              }).format(new Date(Date.UTC(month.year, month.month, 1)))}
            </h2>
            <button
              type="button"
              className="icon-button"
              aria-label="Next month"
              onClick={() => shift(1)}
            >
              <ChevronRight size={17} />
            </button>
            <button
              className="text-button"
              type="button"
              onClick={() =>
                setMonth({
                  year: Number(today.slice(0, 4)),
                  month: Number(today.slice(5, 7)) - 1,
                })
              }
            >
              Today
            </button>
          </div>
          <div className="calendar-scroll">
            <table
              className="schedule-calendar"
              aria-label="Monthly Note schedule"
            >
              <thead>
                <tr>
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day) => (
                      <th className="calendar-weekday" scope="col" key={day}>
                        {day}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: days.length / 7 }, (_, week) => (
                  <tr key={week}>
                    {days.slice(week * 7, week * 7 + 7).map((day) => {
                      const key = dateKey(day, "UTC");
                      return (
                        <td
                          className={`calendar-cell ${day.getUTCMonth() !== month.month ? "outside-month" : ""}`}
                          key={key}
                          aria-label={key}
                          aria-current={today === key ? "date" : undefined}
                        >
                          <time dateTime={key}>{day.getUTCDate()}</time>
                          {dated
                            .filter((item) => dateKey(item.dueAt, zone) === key)
                            .map(card)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className="schedule-list">
          {dated.map((item) => (
            <section className="schedule-list-row" key={item.id}>
              <time>
                {new Intl.DateTimeFormat(undefined, {
                  timeZone: zone,
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                }).format(new Date(item.dueAt))}
              </time>
              {card(item)}
            </section>
          ))}
          {!dated.length && !query.isPending && (
            <p className="empty-filter">
              No dated Notes yet. Approve and schedule a Note from a post.
            </p>
          )}
        </div>
      )}
      {unscheduled.length > 0 && (
        <section className="unscheduled-notes">
          <h2>Without a date</h2>
          <div>{unscheduled.map(card)}</div>
        </section>
      )}
      {selected && (
        <Dialog
          title={labels[selected.status] || selected.status}
          onClose={() => setSelected(null)}
        >
          <p className="schedule-full-text">{selected.text}</p>
          <p className="input-caption">
            {selected.dueAt
              ? new Intl.DateTimeFormat(undefined, {
                  timeZone: zone,
                  dateStyle: "full",
                  timeStyle: "short",
                }).format(new Date(selected.dueAt))
              : "No scheduled time"}{" "}
            · {zone}
          </p>
          {selected.error && <p className="inline-error">{selected.error}</p>}
          <div className="dialog-actions">
            <Link
              href={`/posts/${encodeURIComponent(selected.articleId)}`}
              className="text-button"
            >
              Open post
            </Link>
            {selected.bufferPostId && (
              <a
                href={`https://publish.buffer.com/channels/${encodeURIComponent(selected.channelId)}/schedule`}
                target="_blank"
                rel="noreferrer"
                className="text-button"
              >
                Manage in Buffer
              </a>
            )}
          </div>
        </Dialog>
      )}
    </main>
  );
}
