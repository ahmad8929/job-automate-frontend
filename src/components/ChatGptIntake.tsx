"use client";

import { useState } from "react";
import { api, type DuplicateMatch } from "@/lib/api";

export interface ImportedDraft {
  application_id: number;
  company: string;
  role: string;
  contact_email: string | null;
  job_summary: string;
  subject: string;
  body: string;
  duplicates: DuplicateMatch[];
}

/**
 * Free mode: copy a prompt (with the saved profile baked in) → run it in the ChatGPT app with the screenshot →
 * paste the reply back here. No AI API key involved.
 */
export function ChatGptIntake({
  applicationId,
  onImported,
  onError,
}: {
  applicationId: number | null;
  onImported: (d: ImportedDraft) => void;
  onError: (msg: string | undefined) => void;
}) {
  const [notes, setNotes] = useState("");
  const [reply, setReply] = useState("");
  const [copied, setCopied] = useState(false);
  const [profileReady, setProfileReady] = useState(true);
  const [busy, setBusy] = useState<null | "copy" | "import">(null);

  async function copyPrompt() {
    setBusy("copy");
    onError(undefined);
    try {
      const { prompt, profile_ready } = await api<{ prompt: string; profile_ready: boolean }>("/chatgpt/prompt", {
        method: "POST",
        json: { notes: notes.trim() || undefined },
      });
      await navigator.clipboard.writeText(prompt);
      setProfileReady(profile_ready);
      setCopied(true);
      setTimeout(() => setCopied(false), 4000);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function importReply() {
    setBusy("import");
    onError(undefined);
    try {
      const d = await api<ImportedDraft>("/chatgpt/import", {
        method: "POST",
        json: { reply, application_id: applicationId ?? undefined },
      });
      onImported(d);
    } catch (e) {
      onError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card space-y-5">
      <ol className="space-y-5 text-sm">
        <li className="space-y-2">
          <p className="font-medium">1. Copy the prompt (your profile and resume are already inside)</p>
          <input
            className="input"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional notes for this one, e.g. mention I can join immediately"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-primary" onClick={copyPrompt} disabled={busy !== null}>
              {busy === "copy" ? "Copying…" : copied ? "✓ Copied" : "Copy ChatGPT prompt"}
            </button>
            <a className="btn" href="https://chatgpt.com/" target="_blank" rel="noreferrer">
              Open ChatGPT ↗
            </a>
          </div>
          {!profileReady && (
            <p className="alert-warn">Your profile has no resume text yet, so ChatGPT won&apos;t know your background. Fill in Profile first.</p>
          )}
        </li>
        <li>
          <p className="font-medium">2. In ChatGPT: paste the prompt, attach the screenshot, send</p>
          <p className="text-zinc-500">ChatGPT replies with a block starting with ===JOB===. Copy its whole reply.</p>
        </li>
        <li className="space-y-2">
          <p className="font-medium">3. Paste ChatGPT&apos;s reply here</p>
          <textarea
            className="input min-h-48 font-mono text-xs"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            placeholder={"===JOB===\nCompany: …\nRole: …\nContact email: …\n===EMAIL===\nSubject: …\nBody:\n…\n===END==="}
          />
          <button className="btn-primary" onClick={importReply} disabled={busy !== null || reply.trim().length < 20}>
            {busy === "import" ? "Reading…" : applicationId ? "Re-import reply" : "Read reply"}
          </button>
        </li>
      </ol>
    </section>
  );
}
