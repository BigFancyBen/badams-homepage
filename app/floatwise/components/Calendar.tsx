import { CalendarProps } from "../types";
import { getNext10Days, formatDate, isSameDay } from "../utils";

export function Calendar({ selectedDate, onDateSelect }: CalendarProps) {
  const days = getNext10Days();

  return (
    <div className="w-full mb-2">
      <div className="flex gap-1 overflow-x-auto pb-2 items-center justify-start">
        {days.map((date, index) => {
          const isSelected = isSameDay(date, selectedDate);
          const isToday = isSameDay(date, new Date());

          return (
            <button
              key={date.toISOString()}
              onClick={() => onDateSelect(date)}
              className={`
                shrink-0 border-2 transition-colors min-w-[60px]
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
              <div className="flex flex-row items-center justify-center w-full">
                <div className="text-center text-[10px] font-medium pb-1 pl-1">
                  {formatDate(date)}
                </div>
                <div className="text-[8px]  text-gray-500 dark:text-gray-400 pl-[2px] pr-1 pb-[6px]">
                  {isToday ? "" : index === 0 ? "" : `+${index}`}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
