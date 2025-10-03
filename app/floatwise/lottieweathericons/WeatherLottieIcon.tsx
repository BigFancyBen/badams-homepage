"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

// Import actual Lottie JSON files
// Import actual Lottie JSON files (only those that exist)
import clearDay from "./clear-day.json";
import clearNight from "./clear-night.json";
import cloudy from "./cloudy.json";
import drizzle from "./drizzle.json";
import fog from "./fog.json";
import hail from "./hail.json";
import rain from "./rain.json";
import sleet from "./sleet.json";
import snow from "./snow.json";
import wind from "./wind.json";
import partlyCloudyDay from "./partly-cloudy-day.json";
import partlyCloudyNight from "./partly-cloudy-night.json";
import overcast from "./overcast.json";
import overcastDay from "./overcast-day.json";
import overcastNight from "./overcast-night.json";
import overcastDayRain from "./overcast-day-rain.json";
import overcastNightRain from "./overcast-night-rain.json";
import fogDay from "./fog-day.json";
import fogNight from "./fog-night.json";
import thunderstormsDay from "./thunderstorms-day.json";
import thunderstormsNight from "./thunderstorms-night.json";
import thunderstormsDayRain from "./thunderstorms-day-rain.json";
import thunderstormsNightRain from "./thunderstorms-night-rain.json";

const animations = {
  "clear-day": clearDay,
  "clear-night": clearNight,
  cloudy: cloudy,
  drizzle: drizzle,
  rain: rain,
  fog: fog,
  hail: hail,
  sleet: sleet,
  snow: snow,
  wind: wind,
  "partly-cloudy-day": partlyCloudyDay,
  "partly-cloudy-night": partlyCloudyNight,
  overcast: overcast,
  "overcast-day": overcastDay,
  "overcast-night": overcastNight,
  "overcast-day-rain": overcastDayRain,
  "overcast-night-rain": overcastNightRain,
  "fog-day": fogDay,
  "fog-night": fogNight,
  "thunderstorms-day": thunderstormsDay,
  "thunderstorms-night": thunderstormsNight,
  "thunderstorms-day-rain": thunderstormsDayRain,
  "thunderstorms-night-rain": thunderstormsNightRain,
};

type WeatherIconType = keyof typeof animations;

interface WeatherLottieIconProps {
  type: WeatherIconType;
  className?: string;
  title?: string;
}

export function WeatherLottieIcon({
  type,
  className = "",
  title,
}: WeatherLottieIconProps) {
  const animationData = useMemo(
    () => animations[type] || animations["partly-cloudy-day"],
    [type]
  );
  const wrapperClasses = useMemo(() => getIconWrapperClasses(type), [type]);
  return (
    <div className={`${className} ${wrapperClasses}`} title={title}>
      <Lottie
        animationData={animationData}
        loop={true}
        autoplay={true}
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}

// Apply minimal wrapper styles and condition-based filters; no background colors.
function getIconWrapperClasses(type: WeatherIconType): string {
  // Base keeps icon edges crisp, adds a subtle universal white drop-shadow, no borders/rings
  const base = "rounded-md p-0.5 drop-shadow-[0_0_2px_rgba(255,255,255,0.7)]";

  // Lighten rain/sleet/hail to make dark drops more visible without changing page background
  if (
    type.includes("rain") ||
    type === "drizzle" ||
    type === "sleet" ||
    type === "hail"
  ) {
    // Lighten rainy animations; rely only on universal white drop-shadow (no borders)
    return `${base} filter brightness-150 contrast-110 saturate-90`;
  }

  // Thunderstorms: keep only the universal white shadow (no colored glow/borders)
  if (type.includes("thunderstorms")) {
    return base;
  }

  // Default: no filters, no backgrounds
  return base;
}

// Helper function to map weather conditions to icon types
export function getWeatherLottieIconType(
  shortForecast: string,
  precipChance?: number | null,
  hour?: number
): WeatherIconType {
  const forecast = shortForecast.toLowerCase();
  const isDay = hour === undefined ? true : hour >= 6 && hour <= 19;

  // Prioritize precipitation
  if (
    precipChance !== null &&
    precipChance !== undefined &&
    precipChance >= 50
  ) {
    if (
      forecast.includes("thunder") ||
      forecast.includes("tstorm") ||
      forecast.includes("t-storm") ||
      forecast.includes("storm")
    ) {
      return isDay ? "thunderstorms-day-rain" : "thunderstorms-night-rain";
    } else if (forecast.includes("snow")) {
      return "snow";
    } else if (
      forecast.includes("sleet") ||
      forecast.includes("ice") ||
      forecast.includes("freezing")
    ) {
      return "sleet";
    } else {
      if (forecast.includes("overcast") || forecast.includes("cloud")) {
        return isDay ? "overcast-day-rain" : "overcast-night-rain";
      }
      return "rain";
    }
  }

  // Map specific conditions to icons
  if (
    forecast.includes("thunder") ||
    forecast.includes("tstorm") ||
    forecast.includes("t-storm") ||
    forecast.includes("storm")
  ) {
    return isDay ? "thunderstorms-day" : "thunderstorms-night";
  } else if (
    forecast.includes("rain") ||
    forecast.includes("shower") ||
    forecast.includes("drizzle")
  ) {
    return "rain";
  } else if (forecast.includes("snow") || forecast.includes("flurr")) {
    return "snow";
  } else if (
    forecast.includes("sleet") ||
    forecast.includes("ice") ||
    forecast.includes("freezing")
  ) {
    return "sleet";
  } else if (
    forecast.includes("fog") ||
    forecast.includes("mist") ||
    forecast.includes("haze")
  ) {
    return isDay ? "fog-day" : "fog-night";
  } else if (forecast.includes("hail")) {
    return "hail";
  } else if (forecast.includes("wind")) {
    return "wind";
  } else if (forecast.includes("overcast")) {
    return isDay ? "overcast-day" : "overcast-night";
  } else if (forecast.includes("cloud")) {
    if (
      forecast.includes("partly") ||
      forecast.includes("few") ||
      forecast.includes("scattered") ||
      forecast.includes("mostly")
    ) {
      return isDay ? "partly-cloudy-day" : "partly-cloudy-night";
    }
    return "cloudy";
  } else if (
    forecast.includes("clear") ||
    forecast.includes("sunny") ||
    forecast.includes("fair")
  ) {
    return isDay ? "clear-day" : "clear-night";
  }

  return "partly-cloudy-day"; // Default
}
