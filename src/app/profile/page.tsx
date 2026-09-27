"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, formatDate, type Profile } from "@/lib/api";

type Prefs = Profile["preferences"];

function ProfileInner() {
  const params = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [skills, setSkills] = useState("");
  const [prefs, setPrefs] = useState<Prefs>({});
  const [gmail, setGmail] = useState<{ connected: boolean; email?: string; connected_at?: string } | null>(null);
  const [providers, setProviders] = useState<{ name: string; label: string; configured: boolean; model: string }[]>([]);
  const [busy, setBusy] = useState<null | "save" | "upload" | "gmail">(null);
  // ?gmail=connected|error comes back from the backend's OAuth callback.
  const [error, setError] = useState<string | undefined>(() =>
    params.get("gmail") === "error" ? `Gmail connection failed: ${params.get("message") ?? "unknown error"}` : undefined,
  );
  const [notice, setNotice] = useState<string | undefined>(() =>
    params.get("gmail") === "connected" ? "Gmail connected ✓" : undefined,
  );

  useEffect(() => {
    api<Profile>("/profile").then((p) => {
      setProfile(p);
      setResumeText(p.resume_text);
      setSkills(p.skills.join(", "));
      setPrefs(p.preferences);
    }).catch((e) => setError(e.message));
    api<typeof gmail>("/oauth/google/status").then(setGmail).catch(() => undefined);
    api<{ providers: typeof providers }>("/ai/providers").then((r) => setProviders(r.providers)).catch(() => undefined);
  }, []);

  async function run(kind: NonNullable<typeof busy>, fn: () => Promise<void>) {
    setBusy(kind);
    setError(undefined);
    setNotice(undefined);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const save = () =>
    run("save", async () => {
      const p = await api<Profile>("/profile", {
        method: "PUT",
        json: {
          resume_text: resumeText,
          skills: skills.split(",").map((s) => s.trim()).filter(Boolean),
          preferences: Object.fromEntries(Object.entries(prefs).filter(([, v]) => v !== "" && v !== undefined)),
        },
      });
      setProfile(p);
      setNotice("Profile saved ✓");
    });

  const uploadResume = (file: File) =>
    run("upload", async () => {
      if (file.size > 4 * 1024 * 1024) throw new Error("Resume must be under 4 MB");
      const fd = new FormData();
      fd.append("resume", file);
      const r = await api<{ resume_file_url: string; resume_file_name: string }>("/profile/resume", { method: "POST", body: fd });
      setProfile((p) => (p ? { ...p, ...r } : p));
      setNotice("Resume uploaded ✓");
    });

  const connectGmail = () =>
    run("gmail", async () => {
      const { url } = await api<{ url: string }>("/oauth/google", { method: "POST" });
      window.location.href = url;
    });

  const disconnectGmail = () =>
    run("gmail", async () => {
      if (!window.confirm("Disconnect Gmail? Sending and reply checks will stop until you reconnect.")) return;
      await api("/oauth/google", { method: "DELETE" });
      setGmail({ connected: false });
    });

  const pref = (k: keyof Prefs) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setPrefs((p) => ({ ...p, [k]: e.target.value }));

  if (!profile) return <p className="text-zinc-500">{error ?? "Loading…"}</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-zinc-500">Saved once, reused for every draft. Last updated {formatDate(profile.updated_at)}.</p>
      </div>

      {error && <div className="alert-error">{error}</div>}
      {notice && <div className="alert-ok">{notice}</div>}

      <section className="card space-y-3">
        <h2 className="font-semibold">Gmail</h2>
        {gmail?.connected ? (
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="alert-ok">Connected as {gmail.email}</span>
            <button className="btn" onClick={connectGmail} disabled={busy !== null}>Reconnect</button>
            <button className="btn" onClick={disconnectGmail} disabled={busy !== null}>Disconnect</button>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-zinc-500">Not connected. Needed to send emails and detect replies.</span>
            <button className="btn-primary" onClick={connectGmail} disabled={busy !== null}>
              {busy === "gmail" ? "Redirecting…" : "Connect Gmail"}
            </button>
          </div>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Resume file</h2>
        <p className="text-sm text-zinc-500">Attached to every email you send. PDF or DOCX, up to 4 MB.</p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {profile.resume_file_url ? (
            <a href="/api/backend/profile/resume/file" target="_blank" rel="noreferrer" className="underline">📎 {profile.resume_file_name}</a>
          ) : (
            <span className="text-amber-600">No file uploaded yet</span>
          )}
          <label className="btn cursor-pointer">
            {busy === "upload" ? "Uploading…" : profile.resume_file_url ? "Replace file" : "Upload file"}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              disabled={busy !== null}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) uploadResume(f);
              }}
            />
          </label>
        </div>
      </section>

      <section className="card space-y-4">
        <h2 className="font-semibold">About you</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><input className="input" value={prefs.full_name ?? ""} onChange={pref("full_name")} /></Field>
          <Field label="Phone"><input className="input" value={prefs.phone ?? ""} onChange={pref("phone")} /></Field>
          <Field label="LinkedIn URL"><input className="input" value={prefs.linkedin_url ?? ""} onChange={pref("linkedin_url")} /></Field>
          <Field label="Portfolio / GitHub URL"><input className="input" value={prefs.portfolio_url ?? ""} onChange={pref("portfolio_url")} /></Field>
          <Field label="Target roles"><input className="input" value={prefs.target_roles ?? ""} onChange={pref("target_roles")} placeholder="e.g. Full-stack developer, React developer" /></Field>
          <Field label="Email tone">
            <select className="input" value={prefs.tone ?? "professional"} onChange={pref("tone")}>
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="concise">Concise</option>
              <option value="enthusiastic">Enthusiastic</option>
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="Skills (comma separated)"><input className="input" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, Next.js, Node.js, PostgreSQL" /></Field>
          </div>
          <Field label="Career start (YYYY-MM) — experience is calculated from this">
            <input className="input" value={prefs.career_start ?? ""} onChange={pref("career_start")} placeholder="2024-09" />
          </Field>
          <Field label="AI that writes the emails">
            <select className="input" value={prefs.ai_provider ?? "auto"} onChange={pref("ai_provider")}>
              <option value="auto">Auto (first available, falls back to others)</option>
              {providers.map((p) => (
                <option key={p.name} value={p.name} disabled={!p.configured}>
                  {p.label} · {p.model}{p.configured ? "" : " (no API key)"}
                </option>
              ))}
            </select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="If the job is outside India, also…">
              <textarea className="input min-h-16" value={prefs.abroad_instructions ?? ""} onChange={pref("abroad_instructions")} placeholder="e.g. say I'm working remotely with a Dubai-based startup" />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="Always tell the email writer… (extra facts about you, style)"><textarea className="input min-h-20" value={prefs.extra_instructions ?? ""} onChange={pref("extra_instructions")} placeholder="e.g. I'm available to start immediately; mention I'm open to remote." /></Field>
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">Resume text</h2>
        <p className="text-sm text-zinc-500">Paste your full resume as text. This is what the drafts are tailored from.</p>
        <textarea className="input min-h-96 font-mono text-xs leading-relaxed" value={resumeText} onChange={(e) => setResumeText(e.target.value)} />
      </section>

      <div className="sticky bottom-4 flex justify-end">
        <button className="btn-primary shadow-lg" onClick={save} disabled={busy !== null}>
          {busy === "save" ? "Saving…" : "Save profile"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

export default function ProfilePage() {
  return (
    <Suspense>
      <ProfileInner />
    </Suspense>
  );
}
