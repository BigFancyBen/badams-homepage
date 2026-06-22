"use client";

import { useRiverFlow } from "../hooks/useRiverFlow";

export function RiverFlow() {
  const { flow, isLoading, error } = useRiverFlow();

  if (isLoading) {
    return (
      <div className="flex flex-col leading-tight">
        <span className="text-xs text-gray-400 dark:text-gray-500 animate-pulse">
          Yellowstone @ Livingston…
        </span>
      </div>
    );
  }

  if (error || !flow) {
    return null;
  }

  return (
    <div
      className="flex flex-col leading-tight"
      title={`Yellowstone River near Livingston, MT — updated ${new Date(
        flow.timestamp
      ).toLocaleString()}`}
    >
      <span className="text-base sm:text-lg font-semibold text-blue-600 dark:text-blue-400 tabular-nums">
        {flow.cfs.toLocaleString()} <span className="text-xs font-normal">CFS</span>
      </span>
      <span className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
        Yellowstone @ Livingston
      </span>
    </div>
  );
}
