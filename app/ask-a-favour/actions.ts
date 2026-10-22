"use server";

import { refresh } from "next/cache";
import { askGroq } from "../lib/groq";
import { db, getHouseId, startOfToday } from "../lib/supabase";
import { bump, calculatePoints, estimateFactors, type PointFactors } from "./points";

// Asks Groq for a short title. Falls back to the start of the description so
// a Groq outage never blocks a request.
async function makeTitle(description: string) {
  try {
    const title = (
      await askGroq(
        "Write a title of at most 10 words for this favour request, in the requester's voice, e.g. \"Pick up my medicine from Almara Pharmacy\". Reply with the title only, no quotes.",
        description
      )
    ).replace(/^["']+|["'.]+$/g, "");
    // Hard cap in case the model ignores the word limit.
    if (title) return title.split(/\s+/).slice(0, 12).join(" ");
  } catch (err) {
    console.error("Failed to generate title:", err);
  }
  return description.split(/\s+/).slice(0, 10).join(" ");
}

export async function createFavour(text: string) {
  const description = text.trim().slice(0, 2000);
  if (!description) return { error: "Please enter what help you need." };
  const houseId = await getHouseId();

  // Helpers need the house's address as the favour's location.
  const { data: house, error: houseError } = await db
    .from("houses")
    .select("address")
    .eq("id", houseId)
    .single();

  if (houseError) {
    console.error("Failed to load house:", houseError);
    return { error: "This dashboard isn't linked to a house yet." };
  }

  const [title, factors] = await Promise.all([
    makeTitle(description),
    estimateFactors(description),
  ]);

  const { error } = await db.from("favours").insert({
    title,
    description,
    location: house.address,
    points: calculatePoints(factors),
    point_factors: factors,
    house_id: houseId,
  });

  if (error) {
    console.error("Failed to submit request:", error);
    return { error: "Failed to submit your request. Please try again." };
  }

  return { error: null };
}

// Moves an open request back to the top of the neighbours' feed and adds
// points. Once a day per request.
export async function bumpFavour(id: string) {
  const houseId = await getHouseId();
  const { data: favour } = await db
    .from("favours")
    .select("points, point_factors, bump_points")
    .eq("id", id)
    .eq("house_id", houseId)
    .maybeSingle();
  if (!favour) return { error: "This request could not be found." };

  // Requests from before bumps existed: factors that give the same points.
  const factors: PointFactors = favour.point_factors ?? {
    minutes: favour.points * 15,
    effort: "light",
    skillRisk: 0,
    urgency: 0,
  };
  const next = bump(factors, favour.points);

  // The filters make the rule atomic, so a double tap can't bump twice.
  const { data, error } = await db
    .from("favours")
    .update({
      points: next.points,
      point_factors: next.factors,
      bump_points: favour.bump_points + next.points - favour.points,
      bumped_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("house_id", houseId)
    .eq("status", "open")
    .or(`bumped_at.is.null,bumped_at.lt.${startOfToday().toISOString()}`)
    .select("id");

  if (error) {
    console.error("Failed to bump request:", error);
    return { error: "Failed to bump your request. Please try again." };
  }
  if (!data.length) {
    return { error: "You can bump a request once a day while it waits for a helper." };
  }

  refresh();
  return { error: null };
}
