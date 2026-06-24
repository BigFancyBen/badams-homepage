interface HourSelectorProps {
  selectedHour: number;
  onHourSelect: (hour: number) => void;
}

function formatHour(hour: number): string {
  const ampm = hour < 12 ? 'AM' : 'PM';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12} ${ampm}`;
}

/**
 * Horizontal scroller for picking the hour of day shown on the map.
 * Limited to the same 10am-7pm float window the table view uses.
 * Mirrors the Calendar's button styling.
 */
export function HourSelector({ selectedHour, onHourSelect }: HourSelectorProps) {
  const hours = Array.from({ length: 10 }, (_, i) => i + 10); // 10 (10am) to 19 (7pm)

  return (
    <div className="w-full mb-2">
      <div className="flex gap-1 overflow-x-auto pb-2 items-center justify-start">
        {hours.map((hour) => {
          const isSelected = hour === selectedHour;
          return (
            <button
              key={hour}
              onClick={() => onHourSelect(hour)}
              className={`
                shrink-0 border-2 transition-colors min-w-[48px] py-1 text-[10px] font-medium
                ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200'
                }
              `}
            >
              {formatHour(hour)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
