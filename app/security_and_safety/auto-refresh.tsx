"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// The dashboard is a wall screen nobody taps, so re-read the page every 10 seconds to pick up a resident checking in.
export function AutoRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 10_000);
    return () => clearInterval(timer);
  }, [router]);
  return null;
}
