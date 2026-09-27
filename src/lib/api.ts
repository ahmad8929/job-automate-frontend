// Browser-side helper for calling the backend through the authenticated Next.js proxy.
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`/api/backend${path}`, {
    ...rest,
    headers: json !== undefined ? { "content-type": "application/json", ...rest.headers } : rest.headers,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") window.location.assign("/login"); // eslint-disable-line @next/next/no-location-assign-relative-destination -- full reload, session is gone
    throw new ApiError(res.status, data.error ?? `Request failed (${res.status})`, data.details);
  }
  return data as T;
}

export type Status = "drafted" | "sent" | "replied" | "interview" | "rejected";
export const STATUSES: Status[] = ["drafted", "sent", "replied", "interview", "rejected"];

export interface Application {
  id: number;
  company: string;
  role: string;
  contact_email: string | null;
  job_summary: string | null;
  job_description: string | null;
  screenshot_url: string | null;
  source: "screenshot" | "manual";
  status: Status;
  draft_subject: string | null;
  draft_body: string | null;
  notes: string | null;
  applied_at: string | null;
  followup_at: string | null;
  created_at: string;
  duplicate_count?: number;
  followup_due?: boolean;
}

export interface DuplicateMatch {
  id: number;
  company: string;
  role: string;
  status: Status;
  applied_at: string | null;
  created_at: string;
}

export interface Profile {
  resume_text: string;
  resume_file_url: string | null;
  resume_file_name: string | null;
  skills: string[];
  preferences: {
    full_name?: string;
    phone?: string;
    linkedin_url?: string;
    portfolio_url?: string;
    target_roles?: string;
    tone?: "professional" | "friendly" | "concise" | "enthusiastic";
    extra_instructions?: string;
    abroad_instructions?: string;
    career_start?: string;
    ai_provider?: "auto" | "gemini" | "openai" | "anthropic";
  };
  updated_at: string;
}

export const formatDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
