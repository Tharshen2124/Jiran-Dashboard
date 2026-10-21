"use client";
import { useActionState } from "react";
import { bumpFavour } from "../../actions";

export function BumpButton({ id, bumpedToday }: { id: string; bumpedToday: boolean }) {
  const [state, action, pending] = useActionState<{ error: string | null }>(
    () => bumpFavour(id),
    { error: null }
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <button
        disabled={pending || bumpedToday}
        className="cursor-pointer rounded-[14px] border-none bg-[#d71920] py-5 text-2xl font-bold text-white hover:bg-[#fc4047] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {bumpedToday ? "Bumped Today" : pending ? "Bumping..." : "Bump Request"}
      </button>

      <p className="m-0 text-lg text-[#555]">
        {bumpedToday
          ? "You can bump this request again tomorrow."
          : "Move your request back to the top of your neighbours' list and add more points. Once a day."}
      </p>

      {state.error && (
        <p role="alert" className="m-0 text-lg text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
