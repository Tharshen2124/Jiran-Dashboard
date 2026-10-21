import { createClient } from "@supabase/supabase-js";

// Server-only. Each dashboard is one row in `houses` (HOUSE_ID). There's no
// login on the device, so the server talks to Supabase with the secret key
// and scopes every query to that house.
// ponytail: one secret key per device; swap for per-house credentials before a real rollout.
export const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  { auth: { persistSession: false } }
);

export const HOUSE_ID = process.env.HOUSE_ID!;

export type Status = "open" | "accepted" | "in_progress" | "completed" | "cancelled";

export type Favour = {
  id: string;
  title: string;
  description: string;
  status: Status;
  created_at: string;
  updated_at: string;
  points: number;
  bumped_at: string | null;
  bump_points: number;
  helper: { full_name: string | null } | null;
};

export const FAVOUR_FIELDS =
  "id, title, description, status, created_at, updated_at, points, bumped_at, bump_points, helper:profiles!helper_id(full_name)";

// Midnight in Malaysia (UTC+8, no daylight saving). Bumps reset then.
export const startOfToday = () =>
  new Date(
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kuala_Lumpur" }) +
      "T00:00:00+08:00"
  );

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kuala_Lumpur",
  });
