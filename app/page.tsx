"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { useWeather } from "./hooks/use-weather";
import Image from "next/image";
import Link from "next/link";

const DashboardMainPageV2: NextPage = () => {
  const [now, setNow] = useState<Date | null>(null);
  const { data: weather } = useWeather();

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const weekday = now?.toLocaleDateString("en-GB", { weekday: "long" });
  const dayMonth = now?.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
  });
  const dateText = now ? `${weekday}, ${dayMonth}` : "";
  const timeText = now
    ? now.toLocaleTimeString("en-GB", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "";

  // Sun for clear weather (or while loading), cloud for everything else
  const isClear = !weather || weather.condition === "Clear";

  return (
    <div className="flex min-h-screen w-full flex-col bg-[#f7f9f6] text-[#0b1322] [font-family:Metropolis,ui-sans-serif,system-ui,sans-serif]">
      {/* Top colour bar */}
      <div className="grid h-4 w-full grid-cols-4">
        <div className="bg-[#d71920]" />
        <div className="bg-[#f15a22]" />
        <div className="bg-[#f58220]" />
        <div className="bg-[#fcaf17]" />
      </div>

      <main className="flex flex-1 flex-col gap-4 p-[26px]">
        {/* Date / time / weather card */}
        <section className="flex items-end justify-between rounded-[30px] border border-[#e6e4df] bg-white px-10 py-8">
          <div>
            <h2 className="m-0 text-3xl font-semibold text-[#777] md:text-4xl">
              {dateText}
            </h2>
            <h1 className="m-0 mt-2 text-5xl font-bold md:text-7xl">
              {timeText}
            </h1>
          </div>

          <div className="flex flex-col items-end">
            <Image
              className="h-[60px] w-[60px] object-contain md:h-[80px] md:w-[80px]"
              width={100}
              height={100}
              alt={weather?.condition ?? ""}
              src={isClear ? "/weather-sun-1@2x.png" : "/weather-cloud-1.svg"}
            />
            <h2 className="m-0 text-5xl font-bold md:text-7xl">
              {weather ? `${weather.temp}°C` : "--°C"}
            </h2>
          </div>
        </section>

        {/* Action tiles */}
        <section className="grid flex-1 grid-cols-3 gap-4">
          <Link
            href="/ask-a-favour"
            className="flex min-h-[300px] cursor-pointer flex-col items-center justify-center gap-8 rounded-[30px] bg-[#d71920] px-4 py-8 text-white no-underline hover:bg-[#fc4047]"
          >
            <Image
              className="h-[295px] w-[212px] object-contain"
              width={212}
              height={205}
              alt=""
              src="/helping-hands-1.svg"
            />
            <b className="text-center text-3xl leading-tight md:text-5xl">
              Ask a<br />
              Favour
            </b>
          </Link>

          <Link
            href="/security_and_safety"
            className="flex min-h-[300px] cursor-pointer flex-col items-center justify-center gap-8 rounded-[30px] border border-[#e6e4df] bg-white px-4 py-8 text-[#0b1322] hover:border-[#ccc9c7] hover:bg-[#e6e6e6]">
            <Image
              className="h-[295px] w-[267px] object-contain"
              width={267}
              height={256}
              alt=""
              src="/security-guard-1.svg"
            />
            <b className="text-center text-3xl leading-tight md:text-5xl">
              Check
              <br />
              Security
            </b>
          </Link>

          <Link
            href="/weather"
            className="flex min-h-[300px] cursor-pointer flex-col items-center justify-center gap-8 rounded-[30px] border border-[#e6e4df] bg-white px-4 py-8 text-[#0b1322] no-underline hover:border-[#ccc9c7] hover:bg-[#e6e6e6]"
          >
            <Image
              className="h-[295px] w-[308px] object-contain"
              width={308}
              height={295}
              alt=""
              src="/weather-cloud-1.svg"
            />
            <b className="text-center text-3xl leading-tight md:text-5xl">
              View
              <br />
              Weather
            </b>
          </Link>
        </section>

        <Link
          href="/choose-house"
          className="self-end text-base text-[#777] underline-offset-4 hover:underline"
        >
          Demo only: switch house
        </Link>
      </main>
    </div>
  );
};

export default DashboardMainPageV2;
