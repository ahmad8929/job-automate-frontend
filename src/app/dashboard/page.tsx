"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { api, formatDate, STATUSES, type Application, type Status } from "@/lib/api";
import { STATUS_STYLES } from "@/components/StatusBadge";

interface Stats {
  by_status: Record<Status, number>;
  contacted: number;
  responded: number;
  reply_rate: number;
  followups_due: number;
}

interface Detail extends Application {
  emails: { id: number; recipient: string; subject: string; body: string; sent_at: string }[];
}

interface Filters {
  status: string;
  source: string;
  from: string;
  to: string;
  q: string;
}

export default function DashboardPage() {
  const [apps, setApps] = useState<Application[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [filters, setFilters] = useState<Filters>({ status: "", source: "", from: "", to: "", q: "" });
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  const [checking, setChecking] = useState(false);

  const load = useCallback(async () => {
    try {
      const q = new URLSearchParams(Object.entries(filters).filter(([, v]) => v));
      const [list, s] = await Promise.all([api<Application[]>(`/applications?${q}`), api<Stats>("/applications/stats")]);
      setApps(list);
      setStats(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [filters]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  async function updateStatus(id: number, status: Status) {
    setApps((list) => list?.map((a) => (a.id === id ? { ...a, status } : a)) ?? null);
    try {
      await api(`/applications/${id}`, { method: "PATCH", json: { status } });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      load();
    }
  }

  async function snooze(id: number, days: number) {
    const followup_at = new Date(Date.now() + days * 86_400_000).toISOString();
    await api(`/applications/${id}`, { method: "PATCH", json: { followup_at } }).catch((e) => setError(e.message));
    load();
  }

  async function remove(id: number) {
    if (!window.confirm("Delete this unsent draft?")) return;
    await api(`/applications/${id}`, { method: "DELETE" }).catch((e) => setError(e.message));
    load();
  }

  async function toggle(id: number) {
    if (expanded === id) return setExpanded(null);
    setExpanded(id);
    setDetail(null);
    setDetail(await api<Detail>(`/applications/${id}`));
  }

  async function checkReplies() {
    setChecking(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const res = await api<{ checked: number; updated: { company: string; to: string }[] }>("/gmail/check-replies", { method: "POST" });
      setNotice(
        res.updated.length
          ? `Checked ${res.checked} threads. Updated: ${res.updated.map((u) => `${u.company} → ${u.to}`).join(", ")}`
          : `Checked ${res.checked} threads. No new replies.`,
      );
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setChecking(false);
    }
  }

  const set = (k: keyof Filters) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setFilters((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-zinc-500">Everything you&apos;ve applied to.</p>
        </div>
        <button className="btn" onClick={checkReplies} disabled={checking}>
          {checking ? "Checking Gmail…" : "↻ Check for replies"}
        </button>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {notice && <div className="alert-ok">{notice}</div>}

      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Applied" value={stats.contacted} />
          <Stat label="Replies" value={stats.responded} hint={`${Math.round(stats.reply_rate * 100)}% reply rate`} />
          <Stat label="Interviews" value={stats.by_status.interview} />
          <Stat label="Rejected" value={stats.by_status.rejected} />
          <Stat label="Follow-ups due" value={stats.followups_due} warn={stats.followups_due > 0} />
        </div>
      )}

      <div className="card grid gap-3 sm:grid-cols-5">
        <input className="input sm:col-span-2" placeholder="Search company or role…" value={filters.q} onChange={set("q")} />
        <select className="input" value={filters.status} onChange={set("status")}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select className="input" value={filters.source} onChange={set("source")}>
          <option value="">All sources</option>
          <option value="screenshot">Screenshot</option>
          <option value="manual">Manual</option>
        </select>
        <div className="flex gap-2">
          <input className="input" type="date" value={filters.from} onChange={set("from")} title="Created from" />
          <input className="input" type="date" value={filters.to} onChange={set("to")} title="Created to" />
        </div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500 dark:border-zinc-800">
            <tr>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Applied</th>
              <th className="px-4 py-3">Follow-up</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {apps === null && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">Loading…</td></tr>
            )}
            {apps?.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-zinc-500">No applications yet.</td></tr>
            )}
            {apps?.map((a) => (
              <Fragment key={a.id}>
                <tr className="border-b border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3 font-medium">
                    {a.company}
                    {!!a.duplicate_count && (
                      <span title="You have other applications to this company" className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                        ⚠ duplicate ×{a.duplicate_count + 1}
                      </span>
                    )}
                    <div className="text-xs font-normal text-zinc-500">{a.contact_email ?? "no email"} · {a.source}</div>
                  </td>
                  <td className="px-4 py-3">{a.role}</td>
                  <td className="px-4 py-3">
                    <select
                      value={a.status}
                      onChange={(e) => updateStatus(a.id, e.target.value as Status)}
                      className={`cursor-pointer rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STATUS_STYLES[a.status]}`}
                    >
                      {STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{formatDate(a.applied_at)}</td>
                  <td className={`px-4 py-3 ${a.followup_due ? "font-medium text-red-600" : "text-zinc-600 dark:text-zinc-400"}`}>
                    {a.status === "sent" ? (
                      <>
                        {formatDate(a.followup_at)} {a.followup_due && "· due"}
                        {a.followup_due && (
                          <button onClick={() => snooze(a.id, 7)} className="ml-2 text-xs font-normal text-zinc-500 underline">
                            +7d
                          </button>
                        )}
                      </>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    {a.status === "drafted" && (
                      <button onClick={() => remove(a.id)} className="mr-3 text-xs text-zinc-500 hover:text-red-600">Delete</button>
                    )}
                    <button onClick={() => toggle(a.id)} className="text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">
                      {expanded === a.id ? "Hide" : "Details"}
                    </button>
                  </td>
                </tr>
                {expanded === a.id && (
                  <tr className="border-b border-zinc-100 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
                    <td colSpan={6} className="px-4 py-4">
                      {!detail ? (
                        <p className="text-zinc-500">Loading…</p>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <p className="label">Job summary</p>
                            <p className="whitespace-pre-wrap">{detail.job_summary || "—"}</p>
                            {detail.screenshot_url && (
                              <a href={detail.screenshot_url} target="_blank" rel="noreferrer" className="text-xs underline">
                                View original screenshot
                              </a>
                            )}
                          </div>
                          <div className="space-y-2">
                            <p className="label">{detail.emails.length ? "Sent email" : "Draft"}</p>
                            {(detail.emails[0] ?? (detail.draft_subject ? { subject: detail.draft_subject, body: detail.draft_body ?? "" } : null)) ? (
                              <>
                                <p className="font-medium">{detail.emails[0]?.subject ?? detail.draft_subject}</p>
                                <p className="max-h-60 overflow-y-auto whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
                                  {detail.emails[0]?.body ?? detail.draft_body}
                                </p>
                                {detail.emails.length > 1 && <p className="text-xs text-zinc-500">Sent {detail.emails.length} times</p>}
                              </>
                            ) : (
                              <p>—</p>
                            )}
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, hint, warn }: { label: string; value: number; hint?: string; warn?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${warn ? "text-red-600" : ""}`}>{value}</p>
      {hint && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  );
}
