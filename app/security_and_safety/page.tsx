import Link from "next/link";
import { Suspense } from "react";
import { db, formatTime, getHouseId } from "../lib/supabase";
import { AutoRefresh } from "./auto-refresh";

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

type Tone = "green" | "yellow" | "red";

const dotClasses: Record<Tone, string> = {
  green: "bg-[#12805c]",
  yellow: "bg-[#fcaf17]",
  red: "bg-[#d71920]",
};

const pillClasses: Record<Tone, string> = {
  green: "bg-[#12805c] text-white",
  yellow: "bg-[#fcaf17] text-[#0b1322]",
  red: "bg-[#d71920] text-white",
};

// A jalan counts as patrolled for 2 hours after a guard passes it, like in the Jiran app (PATROL_WINDOW_MS in
// my-app lib/patrols.ts). Guards do a round every 8 hours, so after that it's overdue.
const PATROLLED_MIN = 120;
const toneFor = (minutesAgo: number | null): Tone =>
  minutesAgo === null ? "red" : minutesAgo <= PATROLLED_MIN ? "green" : minutesAgo <= 480 ? "yellow" : "red";

const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const ago = (min: number) =>
  min < 60
    ? rtf.format(-min, "minute")
    : min < 1440
      ? rtf.format(-Math.floor(min / 60), "hour")
      : rtf.format(-Math.floor(min / 1440), "day");

type Jalan = { jalan: string; lastAt: string | null; minutesAgo: number | null };

// Every jalan's latest patrol, most recent first, and this house's jalan. Guards' phones record a patrol event when
// they pass a checkpoint (each jalan has two, one per section); the secret key reads them past RLS.
async function patrols() {
  const [house, checkpoints] = await Promise.all([
    db.from("houses").select("address").eq("id", await getHouseId()).single(),
    db
      .from("checkpoints")
      .select("jalan, patrol_events(created_at)")
      .order("created_at", { referencedTable: "patrol_events", ascending: false })
      .limit(1, { referencedTable: "patrol_events" }),
  ]);
  if (house.error || checkpoints.error) {
    console.error("Failed to load patrols:", house.error ?? checkpoints.error);
    return null;
  }

  const latest = new Map<string, string | null>();
  for (const c of checkpoints.data as { jalan: string; patrol_events: { created_at: string }[] }[]) {
    const at = c.patrol_events[0]?.created_at ?? null;
    const prev = latest.get(c.jalan);
    if (!prev || (at && Date.parse(at) > Date.parse(prev))) latest.set(c.jalan, at);
  }
  const now = Date.now();
  const jalans: Jalan[] = [...latest]
    .map(([jalan, lastAt]) => ({ jalan, lastAt, minutesAgo: lastAt ? Math.floor((now - Date.parse(lastAt)) / 60_000) : null }))
    .sort(
      (a, b) =>
        (a.minutesAgo ?? Infinity) - (b.minutesAgo ?? Infinity) ||
        a.jalan.localeCompare(b.jalan, undefined, { numeric: true })
    );

  // ponytail: reads the jalan out of the address ("No. 12, Jalan SP 10/3"); add a houses.jalan column if formats vary.
  const myJalan = (house.data.address as string).match(/Jalan .+/i)?.[0] ?? null;
  return { jalans, myJalan, mine: jalans.find((j) => j.jalan === myJalan) };
}

async function OngoingPatrols() {
  const result = await patrols();
  if (!result) return <p className="m-0 text-xl">Could not load patrols.</p>;
  const { jalans, myJalan, mine } = result;

  return (
    <>
      <p
        role="status"
        className={`m-0 rounded-[20px] px-6 py-5 text-xl font-bold md:text-2xl ${
          mine ? pillClasses[toneFor(mine.minutesAgo)] : "bg-[#e6e6e6] text-[#555]"
        }`}
      >
        {!mine
          ? `${myJalan ?? "Your jalan"} isn't on the guards' patrol route yet`
          : mine.minutesAgo === null
            ? `${mine.jalan} hasn't been patrolled yet`
            : `${mine.jalan} was ${mine.minutesAgo <= PATROLLED_MIN ? "patrolled" : "last patrolled"} ${ago(mine.minutesAgo)} (${formatTime(mine.lastAt!)})`}
      </p>

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {jalans.map((j) => {
          const tone = toneFor(j.minutesAgo);
          return (
            <li
              key={j.jalan}
              className="flex items-center justify-between gap-4 rounded-[20px] border border-[#e6e4df] px-6 py-5"
            >
              <span className="flex items-center gap-3 text-xl font-bold md:text-2xl">
                <span className={`h-3 w-3 shrink-0 rounded-full ${dotClasses[tone]}`} aria-hidden="true" />
                {j.jalan}
              </span>

              <span className={`shrink-0 rounded-full px-4 py-1 text-base font-bold ${pillClasses[tone]}`}>
                {j.minutesAgo === null ? "Not patrolled yet" : ago(j.minutesAgo)}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

type Trip = { user_id: string; eta: string; resident: { full_name: string | null } | null };

// Residents of this house on their way home (Guardian Angel set on their phone, not checked in yet).
async function tripsHome() {
  const { data, error } = await db
    .from("guardian_angels")
    .select("user_id, eta, resident:profiles(full_name)")
    .eq("house_id", await getHouseId())
    .is("arrived_at", null)
    .order("eta");
  if (error) {
    console.error("Failed to load Guardian Angel:", error);
    return null;
  }
  const now = Date.now();
  return (data as unknown as Trip[]).map((t) => ({ ...t, late: Date.parse(t.eta) < now }));
}

async function GuardianAngelStatus() {
  const trips = await tripsHome();
  if (!trips) return <p className="m-0 text-xl">Could not load Guardian Angel.</p>;
  const active = trips.length > 0;

  return (
    <>
      <p
        role="status"
        className={`m-0 flex items-center gap-3 rounded-[20px] px-6 py-5 text-xl font-bold md:text-2xl ${
          active ? "bg-[#12805c] text-white" : "bg-[#e6e6e6] text-[#555]"
        }`}
      >
        <span
          className={`h-3 w-3 shrink-0 rounded-full ${active ? "animate-pulse bg-white" : "bg-[#777]"}`}
          aria-hidden="true"
        />
        {active ? "Surveillance system is active now" : "Surveillance system is shut off"}
      </p>

      {active ? (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {trips.map((t) => (
            <li
              key={t.user_id}
              className="flex items-center justify-between gap-4 rounded-[20px] border border-[#e6e4df] px-6 py-5"
            >
              <span className="text-xl font-bold md:text-2xl">
                {t.resident?.full_name ?? "A resident"} is on the way home
              </span>
              <span
                className={`shrink-0 rounded-full px-4 py-1 text-base font-bold ${
                  t.late ? "bg-[#d71920] text-white" : "bg-[#fcaf17] text-[#0b1322]"
                }`}
              >
                {t.late ? "Late, expected" : "Expected"} {formatTime(t.eta)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-xl text-[#777]">
          No one is on the way home right now. Set a Guardian Angel in the Jiran app on your phone.
        </p>
      )}
    </>
  );
}

export default function SecurityPage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-[#f7f9f6] text-[#0b1322] [font-family:Metropolis,ui-sans-serif,system-ui,sans-serif]">
      <AutoRefresh />
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
          <h1 className="m-0 text-4xl font-bold md:text-5xl">
            Security and Safety
          </h1>

          <Link
            href="/"
            className="flex cursor-pointer items-center gap-2 rounded-[20px] border border-[#e6e4df] bg-white px-8 py-4 text-xl font-bold text-[#0b1322] no-underline hover:border-[#ccc9c7] hover:bg-[#e6e6e6] md:text-2xl"
          >
            <BackIcon />
            Back to Home
          </Link>
        </header>

        <section className="grid flex-1 grid-cols-1 gap-4 md:grid-cols-2">
          {/* Guardian Angel */}
          <article className="flex flex-col gap-6 rounded-[30px] border border-[#e6e4df] bg-white p-8">
            <h2 className="m-0 text-3xl font-bold md:text-4xl">
              Guardian Angel
            </h2>

            <p className="m-0 text-xl leading-snug text-[#777] md:text-2xl">
              If you don&apos;t get home by the expected time, we will check on
              you before alerting your trusted neighbours.
            </p>

            <Suspense fallback={<p className="m-0 text-xl">Loading Guardian Angel...</p>}>
              <GuardianAngelStatus />
            </Suspense>

            <p className="m-0 mt-auto text-center text-base text-[#777]">
              Don&apos;t forget to check in if you have set a guardian angel.
            </p>
          </article>

          {/* Ongoing Patrols */}
          <article className="flex flex-col gap-4 rounded-[30px] border border-[#e6e4df] bg-white p-8">
            <h2 className="m-0 text-3xl font-bold md:text-4xl">
              Ongoing Patrols
            </h2>

            <Suspense fallback={<p className="m-0 text-xl">Loading patrols...</p>}>
              <OngoingPatrols />
            </Suspense>

            <p className="m-0 mt-auto text-center text-base text-[#777]">
              Times are when a guard last passed each jalan. Green means in the last 2 hours.
            </p>
          </article>
        </section>
      </main>
    </div>
  );
}
