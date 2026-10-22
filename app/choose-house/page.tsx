import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { db, HOUSE_COOKIE } from "../lib/supabase";

async function chooseHouse(form: FormData) {
  "use server";
  const id = String(form.get("id"));
  // Every query on this dashboard is scoped by this cookie, so only accept a real house.
  const { data } = await db.from("houses").select("id").eq("id", id).maybeSingle();
  if (!data) return;
  (await cookies()).set(HOUSE_COOKIE, id, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365 });
  redirect("/");
}

async function HouseList() {
  const current = (await cookies()).get(HOUSE_COOKIE)?.value;
  const { data, error } = await db.from("houses").select("id, address").order("created_at");

  if (error) {
    console.error("Failed to load houses:", error);
    return <p className="m-0 text-xl">Could not load the houses.</p>;
  }

  return (
    <>
      <form action={chooseHouse} className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {data.map((h) => (
          <button
            key={h.id}
            name="id"
            value={h.id}
            aria-current={h.id === current || undefined}
            className="flex min-h-[180px] cursor-pointer flex-col items-start justify-between gap-6 rounded-[30px] border border-[#e6e4df] bg-white p-8 text-left text-3xl font-bold text-[#0b1322] hover:border-[#ccc9c7] hover:bg-[#e6e6e6] aria-[current]:border-4 aria-[current]:border-[#12805c]"
          >
            {h.address}
            {h.id === current && (
              <span className="rounded-full bg-[#12805c] px-4 py-1 text-base text-white">This dashboard</span>
            )}
          </button>
        ))}
      </form>

      {current && (
        <Link
          href="/"
          className="self-start rounded-[20px] border border-[#e6e4df] bg-white px-8 py-4 text-xl font-bold text-[#0b1322] no-underline hover:border-[#ccc9c7] hover:bg-[#e6e6e6] md:text-2xl"
        >
          Back to Home
        </Link>
      )}
    </>
  );
}

export default function ChooseHousePage() {
  return (
    <div className="flex min-h-screen w-full flex-col bg-[#f7f9f6] text-[#0b1322] [font-family:Metropolis,ui-sans-serif,system-ui,sans-serif]">
      {/* Top colour bar */}
      <div className="grid h-4 w-full grid-cols-4">
        <div className="bg-[#d71920]" />
        <div className="bg-[#f15a22]" />
        <div className="bg-[#f58220]" />
        <div className="bg-[#fcaf17]" />
      </div>

      <main className="flex flex-1 flex-col gap-6 px-5 pb-5 pt-4">
        <header className="flex flex-col items-start gap-3">
          <span className="rounded-full bg-[#fcaf17] px-4 py-1 text-base font-bold uppercase tracking-wide">
            For demo purposes only
          </span>
          <h1 className="m-0 text-4xl font-bold md:text-5xl">Which house is this dashboard?</h1>
          <p className="m-0 max-w-[60ch] text-xl text-[#555]">
            Each home dashboard is mounted at one house. For the demo, pick the house this screen belongs to. You can
            switch any time from the home screen.
          </p>
        </header>

        <Suspense fallback={<p className="m-0 text-xl">Loading houses...</p>}>
          <HouseList />
        </Suspense>
      </main>
    </div>
  );
}
