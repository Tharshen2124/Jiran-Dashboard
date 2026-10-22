import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import {
  db,
  FAVOUR_FIELDS,
  formatTime,
  getHouseId,
  type Favour,
  type Status,
} from "../../lib/supabase";

const BackIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M10 8V4l-8 8 8 8v-4.1c5.6 0 9.5 1.8 12 5.6-1-6-4.6-10.9-12-11.5z" />
  </svg>
);

type Tone = "green" | "yellow" | "grey";

const toneClasses: Record<Tone, string> = {
  green: "bg-[#12805c] text-white",
  yellow: "bg-[#fcaf17] text-[#0b1322]",
  grey: "bg-[#777] text-white",
};

const STATUS: Record<Status, { label: string; tone: Tone }> = {
  open: { label: "Waiting for helper", tone: "yellow" },
  accepted: { label: "Helper found", tone: "green" },
  in_progress: { label: "Helper on the way", tone: "green" },
  completed: { label: "Done", tone: "grey" },
  cancelled: { label: "Cancelled", tone: "grey" },
};

async function RequestList() {
  await connection();
  const houseId = await getHouseId();
  const { data, error } = await db
    .from("favours")
    .select(FAVOUR_FIELDS)
    .eq("house_id", houseId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load requests:", error);
    return <p className="m-0 text-xl">Could not load your requests.</p>;
  }

  const requests = data as unknown as Favour[];
  if (!requests.length) {
    return <p className="m-0 text-xl">You haven&apos;t asked for any favours yet.</p>;
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {requests.map((r) => (
        <li
          key={r.id}
          className="flex items-center justify-between gap-6 rounded-[20px] border border-[#e6e4df] bg-white px-6 py-5"
        >
          <div className="flex min-w-0 flex-col gap-2">
            <h2 className="m-0 truncate text-xl font-bold md:text-2xl">
              {r.title}
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-4 py-1 text-base font-bold ${toneClasses[STATUS[r.status].tone]}`}
              >
                {STATUS[r.status].label}
              </span>
              <span className="text-base text-[#777]">
                Asked {formatTime(r.created_at)}
              </span>
            </div>
          </div>

          <Link
            href={`/ask-a-favour/check-requests/details?id=${r.id}`}
            className="shrink-0 cursor-pointer rounded-[14px] bg-[#0b1322] px-10 py-4 text-xl font-bold text-white no-underline hover:bg-[#1c2a44] md:text-2xl"
          >
            Details
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function CheckRequestsPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-[#f7f9f6] text-[#0b1322] [font-family:Metropolis,ui-sans-serif,system-ui,sans-serif]">
      {/* Top colour bar */}
      <div className="grid h-4 w-full grid-cols-4">
        <div className="bg-[#d71920]" />
        <div className="bg-[#f15a22]" />
        <div className="bg-[#f58220]" />
        <div className="bg-[#fcaf17]" />
      </div>

      <main className="flex flex-1 flex-col gap-4 px-5 pb-5 pt-4">
        {/* Header */}
        <header className="flex items-center justify-between gap-4">
          <h1 className="m-0 text-4xl font-bold md:text-5xl">Check Requests</h1>

          <Link
            href="/ask-a-favour"
            className="flex cursor-pointer items-center gap-2 rounded-[20px] border border-[#e6e4df] bg-white px-8 py-4 text-xl font-bold text-[#0b1322] no-underline hover:border-[#ccc9c7] hover:bg-[#e6e6e6] md:text-2xl"
          >
            <BackIcon />
            Back
          </Link>
        </header>

        {/* Request list */}
        <Suspense fallback={<p className="m-0 text-xl">Loading your requests...</p>}>
          <RequestList />
        </Suspense>
      </main>
    </div>
  );
}
