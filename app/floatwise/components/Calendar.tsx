import { CalendarProps } from "../types";
import { getNext10Days, formatDate, isSameDay } from "../utils";

export function Calendar({ selectedDate, onDateSelect }: CalendarProps) {
  const days = getNext10Days();

  return (
    <div className="w-full mb-4 sm:mb-8">
      <h2 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-4 text-gray-900 dark:text-gray-100">
        Select Date
      </h2>
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
