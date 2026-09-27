"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  ApiError,
  formatDate,
  type DuplicateMatch,
  type Profile,
} from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { ChatGptIntake, type ImportedDraft } from "@/components/ChatGptIntake";

interface Draft {
  application_id: number;
  company: string;
  role: string;
  location: string | null;
  poster_name: string | null;
  job_summary: string;
  to: string;
  subject: string;
  body: string;
  duplicates: DuplicateMatch[];
  warning?: string;
  provider?: string;
}

interface ComposeResponse {
  application_id: number;
  provider: string;
  company: string;
  role: string;
  contact_email: string | null;
  poster_name: string | null;
  location: string | null;
  job_summary: string;
  subject: string;
  body: string;
  duplicates: DuplicateMatch[];
  warning?: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  gemini: "Gemini",
  openai: "ChatGPT",
  anthropic: "Claude",
  "chatgpt-app": "ChatGPT app",
};

/** Textarea that grows with its content. */
function AutoTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
    minRows?: number;
  },
) {
  const { minRows = 3, className, ...rest } = props;
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fit = () => {
      el.style.height = "";
      // Empty: keep the rows-based height (measuring the placeholder before layout gives huge values).
      if (el.value)
        el.style.height = `${Math.max(el.scrollHeight + 2, el.clientHeight)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [props.value]);
  return (
    <textarea
      ref={ref}
      rows={minRows}
      className={`resize-none ${className ?? ""}`}
      {...rest}
    />
  );
}

export default function ApplyPage() {
  const [text, setText] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [rewriteNote, setRewriteNote] = useState("");
  const [attachResume, setAttachResume] = useState(true);
  const [showDetails, setShowDetails] = useState(false);
  const [useChatGpt, setUseChatGpt] = useState(false);
  const [postExpanded, setPostExpanded] = useState(false);
  // Set when the user edits a post that already has a draft, so re-writing updates that draft instead of adding one.
  const [editingId, setEditingId] = useState<number | null>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [gmail, setGmail] = useState<{
    connected: boolean;
    email?: string;
  } | null>(null);
  const [busy, setBusy] = useState<null | "write" | "rewrite" | "send">(null);
  const [error, setError] = useState<string>();
  const [sent, setSent] = useState<{ to: string; company: string } | null>(
    null,
  );
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<Profile>("/profile")
      .then(setProfile)
      .catch(() => undefined);
    api<{ connected: boolean; email?: string }>("/oauth/google/status")
      .then(setGmail)
      .catch(() => undefined);
  }, []);

  const pickImage = useCallback((f: File | null) => {
    if (f && !f.type.startsWith("image/"))
      return setError("Only images can be attached (PNG, JPG, WEBP, GIF)");
    if (f && f.size > 4 * 1024 * 1024)
      return setError("Screenshot must be under 4 MB");
    setError(undefined);
    setImage(f);
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return f ? URL.createObjectURL(f) : null;
    });
  }, []);

  // ⌘V a screenshot anywhere on the page.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const f = Array.from(e.clipboardData?.items ?? [])
        .find((i) => i.type.startsWith("image/"))
        ?.getAsFile();
      if (f) {
        e.preventDefault();
        pickImage(f);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [pickImage]);

  async function run(kind: NonNullable<typeof busy>, fn: () => Promise<void>) {
    setBusy(kind);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const canWrite = Boolean(image) || text.trim().length >= 20;

  const write = () =>
    run("write", async () => {
      if (!canWrite) return;
      setSent(null);
      const fd = new FormData();
      if (text.trim()) fd.append("text", text.trim());
      if (image) fd.append("screenshot", image);
      if (editingId) fd.append("application_id", String(editingId));
      const r = await api<ComposeResponse>("/compose", {
        method: "POST",
        body: fd,
      });
      setDraft({
        application_id: r.application_id,
        company: r.company,
        role: r.role,
        location: r.location,
        poster_name: r.poster_name,
        job_summary: r.job_summary,
        to: r.contact_email ?? "",
        subject: r.subject,
        body: r.body,
        duplicates: r.duplicates,
        warning: r.warning,
        provider: r.provider,
      });
      setShowDetails(false);
      setPostExpanded(false);
      setEditingId(null);
    });

  function editPost() {
    if (draft) setEditingId(draft.application_id);
    setDraft(null);
  }

  const rewrite = () =>
    run("rewrite", async () => {
      if (!draft) return;
      const r = await api<{ subject: string; body: string; provider: string }>(
        "/draft",
        {
          method: "POST",
          json: {
            application_id: draft.application_id,
            company: draft.company,
            role: draft.role,
            contact_email: draft.to.trim() || null,
            job_summary: draft.job_summary,
            poster_name: draft.poster_name,
            location: draft.location,
            source: image ? "screenshot" : "manual",
            note: image ? text.trim() || null : null, // with a screenshot, the typed text is your note
            instructions: rewriteNote.trim() || undefined,
          },
        },
      );
      setDraft({
        ...draft,
        subject: r.subject,
        body: r.body,
        provider: r.provider,
      });
      setRewriteNote("");
    });

  const send = () =>
    run("send", async () => {
      if (!draft) return;
      const to = draft.to.trim();
      const post = (force: boolean) =>
        api("/send", {
          method: "POST",
          json: {
            application_id: draft.application_id,
            to,
            subject: draft.subject,
            body: draft.body,
            attach_resume: attachResume,
            force,
            company: draft.company.trim() || undefined,
            role: draft.role.trim() || undefined,
          },
        });
      try {
        await post(false);
      } catch (e) {
        if (!(
          e instanceof ApiError &&
          (e.details as { requires_force?: boolean })?.requires_force
        ))
          throw e;
        if (!window.confirm(e.message)) return;
        await post(true);
      }
      setSent({ to, company: draft.company });
      startOver();
    });

  function startOver() {
    setDraft(null);
    setEditingId(null);
    setText("");
    pickImage(null);
    setRewriteNote("");
  }

  function onImported(d: ImportedDraft) {
    setDraft({
      application_id: d.application_id,
      company: d.company,
      role: d.role,
      location: null,
      poster_name: null,
      job_summary: d.job_summary,
      to: d.contact_email ?? "",
      subject: d.subject,
      body: d.body,
      duplicates: d.duplicates,
      provider: "chatgpt-app",
    });
    setUseChatGpt(false);
  }

  const update =
    (k: keyof Draft) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((d) => (d ? { ...d, [k]: e.target.value } : d));

  const setup = [
    profile && !profile.resume_text.trim() && "resume",
    profile && !profile.resume_file_url && "resume file",
    gmail && !gmail.connected && "Gmail",
  ].filter(Boolean);

  const sendBlocker = !draft
    ? null
    : !draft.to.trim()
      ? "Add the recipient's email"
      : !gmail?.connected
        ? "Connect Gmail on Profile"
        : attachResume && !profile?.resume_file_url
          ? "Upload your resume file on Profile"
          : null;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {setup.length > 0 && (
        <div className="alert-warn">
          Finish setup: add your {setup.join(", ")} on{" "}
          <Link href="/profile" className="underline">
            Profile
          </Link>
          .
        </div>
      )}
      {sent && (
        <div className="alert-ok flex items-center justify-between">
          <span>
            ✓ Sent to {sent.to} ({sent.company})
          </span>
          <Link href="/dashboard" className="underline">
            Dashboard
          </Link>
        </div>
      )}
      {error && <div className="alert-error">{error}</div>}

      {/* Composer */}
      {!draft && !useChatGpt && (
        <div
          className="card space-y-3 p-4"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            pickImage(e.dataTransfer.files[0] ?? null);
          }}
        >
          <AutoTextarea
            minRows={5}
            autoFocus
            className="w-full bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-zinc-500"
            placeholder={
              image
                ? "Add a note for this email (optional), e.g. I'm open to relocating and can join immediately…"
                : "Paste the job post here, or attach / paste (⌘V) a screenshot…"
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) write();
            }}
          />
          {preview && (
            <div className="relative inline-block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Attached screenshot"
                className="max-h-56 rounded-lg border border-zinc-200 dark:border-zinc-700"
              />
              <button
                onClick={() => pickImage(null)}
                className="absolute -right-2 -top-2 h-6 w-6 rounded-full bg-zinc-900 text-xs text-white dark:bg-zinc-100 dark:text-zinc-900"
                aria-label="Remove screenshot"
              >
                ✕
              </button>
            </div>
          )}
          <div className="flex items-center justify-between">
            <button className="btn" onClick={() => fileInput.current?.click()}>
              📎 {image ? "Change image" : "Attach image"}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              onChange={(e) => {
                pickImage(e.target.files?.[0] ?? null);
                e.target.value = "";
              }}
            />
            <button
              className="btn-primary"
              onClick={write}
              disabled={!canWrite || busy !== null}
            >
              {busy === "write"
                ? "Writing…"
                : editingId
                  ? "Rewrite email →"
                  : "Write email →"}
            </button>
          </div>
        </div>
      )}
      {busy === "write" && (
        <p className="text-center text-sm text-zinc-500">
          Reading the post and writing your email… (about 10 seconds)
        </p>
      )}

      {!draft && useChatGpt && (
        <ChatGptIntake
          applicationId={null}
          onImported={onImported}
          onError={setError}
        />
      )}

      {/* The post you entered stays visible above the draft, like a chat message */}
      {draft && (text.trim() || preview) && (
        <div className="ml-auto max-w-[85%] space-y-2 rounded-2xl rounded-tr-sm bg-zinc-200 px-4 py-3 text-sm dark:bg-zinc-800">
          {preview && (
            <a href={preview} target="_blank" rel="noreferrer">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview}
                alt="Your screenshot"
                className="max-h-48 rounded-lg"
              />
            </a>
          )}
          {text.trim() && (
            <p
              className={`whitespace-pre-wrap text-zinc-700 dark:text-zinc-300 ${postExpanded ? "" : "line-clamp-5"}`}
            >
              {preview && (
                <span className="mr-1 text-xs font-medium uppercase text-zinc-500">
                  Your note:
                </span>
              )}
              {text.trim()}
            </p>
          )}
          <div className="flex justify-end gap-3 text-xs text-zinc-500">
            {text.trim().split("\n").length > 5 || text.trim().length > 400 ? (
              <button
                onClick={() => setPostExpanded((v) => !v)}
                className="underline"
              >
                {postExpanded ? "Show less" : "Show more"}
              </button>
            ) : null}
            <button onClick={editPost} className="underline">
              ✎ Edit post
            </button>
          </div>
        </div>
      )}

      {/* Draft */}
      {draft && (
        <div className="card space-y-3 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm">
              <span className="font-semibold">{draft.company}</span>
              <span className="text-zinc-500">
                {" "}
                · {draft.role}
                {draft.location ? ` · ${draft.location}` : ""}
              </span>
              <button
                onClick={() => setShowDetails((v) => !v)}
                className="ml-2 text-xs text-zinc-500 underline"
              >
                {showDetails ? "hide" : "edit"}
              </button>
            </div>
            <button
              onClick={startOver}
              className="shrink-0 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            >
              ✕ New
            </button>
          </div>

          {showDetails && (
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                className="input"
                value={draft.company}
                onChange={update("company")}
                placeholder="Company"
              />
              <input
                className="input"
                value={draft.role}
                onChange={update("role")}
                placeholder="Role"
              />
            </div>
          )}

          {draft.duplicates.length > 0 && (
            <div className="alert-warn text-sm">
              ⚠ Already applied to {draft.company}:{" "}
              {draft.duplicates.map((d) => (
                <span
                  key={d.id}
                  className="mr-2 inline-flex items-center gap-1"
                >
                  <StatusBadge status={d.status} /> {d.role} (
                  {formatDate(d.applied_at ?? d.created_at)})
                </span>
              ))}
            </div>
          )}
          {draft.warning && (
            <div className="alert-warn text-sm">{draft.warning}</div>
          )}

          <div className="space-y-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            <label className="flex items-center gap-2 text-sm">
              <span className="w-16 shrink-0 text-zinc-500">To</span>
              <input
                className="input"
                type="email"
                value={draft.to}
                onChange={update("to")}
                placeholder="No email found in the post — type it here"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <span className="w-16 shrink-0 text-zinc-500">Subject</span>
              <input
                className="input"
                value={draft.subject}
                onChange={update("subject")}
              />
            </label>
          </div>
          <AutoTextarea
            minRows={10}
            className="input leading-relaxed"
            value={draft.body}
            onChange={update("body")}
          />

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-500">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={attachResume}
                onChange={(e) => setAttachResume(e.target.checked)}
              />
              📎 {profile?.resume_file_name ?? "resume"}
            </label>
            {draft.provider && (
              <span>
                written by {PROVIDER_LABELS[draft.provider] ?? draft.provider}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
            {draft.provider !== "chatgpt-app" && (
              <>
                <input
                  className="input min-w-0 flex-1"
                  value={rewriteNote}
                  onChange={(e) => setRewriteNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") rewrite();
                  }}
                  placeholder="Change something? e.g. shorter, mention I can join immediately"
                />
                <button
                  className="btn"
                  onClick={rewrite}
                  disabled={busy !== null}
                >
                  {busy === "rewrite" ? "Rewriting…" : "↻ Rewrite"}
                </button>
              </>
            )}
            <button
              className="btn-primary ml-auto"
              onClick={send}
              disabled={busy !== null || Boolean(sendBlocker)}
              title={sendBlocker ?? undefined}
            >
              {busy === "send" ? "Sending…" : "Send ✈"}
            </button>
          </div>
          {sendBlocker && (
            <p className="text-right text-xs text-amber-600">{sendBlocker}</p>
          )}
        </div>
      )}

      {!draft && (
        <p className="text-center text-xs text-zinc-500">
          <button
            onClick={() => setUseChatGpt((v) => !v)}
            className="underline"
          >
            {useChatGpt
              ? "← Back to automatic"
              : "Or write it in your ChatGPT app instead (free)"}
          </button>
        </p>
      )}
    </div>
  );
}
