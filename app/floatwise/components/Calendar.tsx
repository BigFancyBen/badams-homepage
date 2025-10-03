import { useState } from "react";
import { CalendarProps } from "../types";
import { getNext10Days, formatDate, isSameDay } from "../utils";

export function Calendar({ selectedDate, onDateSelect, onShareClick }: CalendarProps) {
  const days = getNext10Days();
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);

  const handleShareClick = async () => {
    await onShareClick();
    setShowCopiedMessage(true);
    setTimeout(() => setShowCopiedMessage(false), 2000);
  };

  return (
    <div className="w-full mb-4 sm:mb-8">
      <div className="flex justify-between items-center mb-2 sm:mb-4">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
          Select Date
        </h2>
        <div className="relative">
          <button
            onClick={handleShareClick}
            className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs sm:text-sm rounded transition-colors"
            title="Share locations"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span className="hidden sm:inline">Share</span>
          </button>
          {showCopiedMessage && (
            <div className="absolute top-full right-0 mt-1 px-2 py-1 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded whitespace-nowrap">
              Link copied!
            </div>
          )}
        </div>
      </div>
      <div className="flex gap-1 sm:gap-2 overflow-x-auto pb-2">
        {days.map((date, index) => {
          const isSelected = isSameDay(date, selectedDate);
          const isToday = isSameDay(date, new Date());

          return (
            <button
              key={date.toISOString()}
              onClick={() => onDateSelect(date)}
              className={`
                flex-shrink-0 px-2 sm:px-4 py-2 sm:py-3 border-2 transition-colors min-w-[80px] sm:min-w-[100px]
                ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                    : "border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200"
                }
                ${
                  isToday && !isSelected
                    ? "ring-2 ring-blue-200 dark:ring-blue-700"
                    : ""
                }
              `}
            >
              <div className="text-center">
                <div className="text-xs sm:text-sm font-medium">
                  {formatDate(date)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {isToday ? "Today" : index === 0 ? "Today" : `+${index}d`}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
