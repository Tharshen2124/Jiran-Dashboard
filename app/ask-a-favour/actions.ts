"use server";

import { askGroq } from "../lib/groq";
import { db, HOUSE_ID } from "../lib/supabase";
import { estimatePoints } from "./points";

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

  // Helpers need the house's address as the favour's location.
  const { data: house, error: houseError } = await db
    .from("houses")
    .select("address")
    .eq("id", HOUSE_ID)
    .single();

  if (houseError) {
    console.error("Failed to load house:", houseError);
    return { error: "This dashboard isn't linked to a house yet." };
  }

  const [title, points] = await Promise.all([
    makeTitle(description),
    estimatePoints(description),
  ]);

  const { error } = await db.from("favours").insert({
    title,
    description,
    location: house.address,
    points,
    house_id: HOUSE_ID,
  });

  if (error) {
    console.error("Failed to submit request:", error);
    return { error: "Failed to submit your request. Please try again." };
  }

  return { error: null };
}
