'use client';

import dynamic from 'next/dynamic';
import { useMemo } from 'react';

// Dynamically import Lottie to avoid SSR issues
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

// Import animations - these would be actual Lottie JSON files
// For now, using inline minimal animations as placeholders
const animations = {
  'rain': {
    v: "5.5.7",
    fr: 30,
    ip: 0,
    op: 60,
    w: 100,
    h: 100,
    nm: "Rain",
    ddd: 0,
    assets: [],
    layers: []
  },
  'thunderstorms': {
    v: "5.5.7",
    fr: 30,
    ip: 0,
    op: 60,
    w: 100,
    h: 100,
    nm: "Thunderstorms",
    ddd: 0,
    assets: [],
    layers: []
  },
  'snow': {
    v: "5.5.7",
    fr: 30,
    ip: 0,
    op: 60,
    w: 100,
    h: 100,
    nm: "Snow",
    ddd: 0,
    assets: [],
    layers: []
  },
  'partly-cloudy': {
    v: "5.5.7",
    fr: 30,
    ip: 0,
    op: 60,
    w: 100,
    h: 100,
    nm: "Partly Cloudy",
    ddd: 0,
    assets: [],
    layers: []
  },
  'cloudy': {
    v: "5.5.7",
    fr: 30,
    ip: 0,
    op: 60,
    w: 100,
    h: 100,
    nm: "Cloudy",
    ddd: 0,
    assets: [],
    layers: []
  },
  'clear': {
    v: "5.5.7",
    fr: 30,
    ip: 0,
    op: 60,
    w: 100,
    h: 100,
    nm: "Clear",
    ddd: 0,
    assets: [],
    layers: []
  },
  'fog': {
    v: "5.5.7",
    fr: 30,
    ip: 0,
    op: 60,
    w: 100,
    h: 100,
    nm: "Fog",
    ddd: 0,
    assets: [],
    layers: []
  },
  'sleet': {
    v: "5.5.7",
    fr: 30,
    ip: 0,
    op: 60,
    w: 100,
    h: 100,
    nm: "Sleet",
    ddd: 0,
    assets: [],
    layers: []
  },
  'wind': {
    v: "5.5.7",
    fr: 30,
    ip: 0,
    op: 60,
    w: 100,
    h: 100,
    nm: "Wind",
    ddd: 0,
    assets: [],
    layers: []
  },
  'overcast': {
    v: "5.5.7",
    fr: 30,
    ip: 0,
    op: 60,
    w: 100,
    h: 100,
    nm: "Overcast",
    ddd: 0,
    assets: [],
    layers: []
  }
};

type WeatherIconType = keyof typeof animations;

interface WeatherLottieIconProps {
  type: WeatherIconType;
  className?: string;
  title?: string;
}

export function WeatherLottieIcon({ type, className = '', title }: WeatherLottieIconProps) {
  const animationData = useMemo(() => animations[type] || animations['partly-cloudy'], [type]);

  return (
    <div className={className} title={title}>
      <Lottie
        animationData={animationData}
        loop={true}
        autoplay={true}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}

// Helper function to map weather conditions to icon types
export function getWeatherLottieIconType(shortForecast: string, precipChance?: number | null): WeatherIconType {
  const forecast = shortForecast.toLowerCase();
  
  // HIGH PRIORITY: Check precipitation percentage first
  if (precipChance !== null && precipChance !== undefined && precipChance >= 50) {
    if (forecast.includes("thunder") || forecast.includes("tstorm") || forecast.includes("t-storm")) {
      return "thunderstorms";
    } else if (forecast.includes("snow")) {
      return "snow";
    } else {
      return "rain";
    }
  }
  
  // Check for specific weather conditions
  if (forecast.includes("thunder") || forecast.includes("tstorm") || forecast.includes("t-storm")) {
    return "thunderstorms";
  } else if (forecast.includes("rain") || forecast.includes("shower") || forecast.includes("drizzle")) {
    return "rain";
  } else if (forecast.includes("snow") || forecast.includes("flurr")) {
    return "snow";
  } else if (forecast.includes("sleet") || forecast.includes("ice") || forecast.includes("freezing")) {
    return "sleet";
  } else if (forecast.includes("fog") || forecast.includes("mist") || forecast.includes("haze")) {
    return "fog";
  } else if (forecast.includes("wind")) {
    return "wind";
  } else if (forecast.includes("overcast")) {
    return "overcast";
  } else if (forecast.includes("cloud")) {
    if (forecast.includes("partly") || forecast.includes("few") || forecast.includes("scattered")) {
      return "partly-cloudy";
    }
    return "cloudy";
  } else if (forecast.includes("partly") || forecast.includes("mostly")) {
    return "partly-cloudy";
  } else if (forecast.includes("clear") || forecast.includes("sunny") || forecast.includes("fair")) {
    return "clear";
  }
  
  return "partly-cloudy"; // Default
}
