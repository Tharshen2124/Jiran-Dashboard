"use server";

import { db, HOUSE_ID } from "../lib/supabase";

// ponytail: flat reward per favour; let the requester pick if helpers need more incentive.
const POINTS = 10;

export async function createFavour(text: string) {
  const title = text.trim().slice(0, 2000);
  if (!title) return { error: "Please enter what help you need." };

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

  const { error } = await db.from("favours").insert({
    title,
    location: house.address,
    points: POINTS,
    house_id: HOUSE_ID,
  });

  if (error) {
    console.error("Failed to submit request:", error);
    return { error: "Failed to submit your request. Please try again." };
  }

  return { error: null };
}
