import { useState } from "react";
import { LocationManagerProps, Location } from "../types";
import { AddLocationModal } from "./AddLocationModal";

export function LocationManager({
  locations,
  onAddLocation,
  onRemoveLocation,
}: LocationManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleAddLocation = (location: Location) => {
    onAddLocation(location);
    setIsModalOpen(false);
  };

  return (
    <div className="w-full mb-4 sm:mb-6">
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">
          Weather Locations
        </h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-8 h-8 bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors flex items-center justify-center"
          title="Manage locations"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        </button>
      </div>

      {locations.length === 0 && (
        <div className="text-center py-6 sm:py-8 text-gray-500 dark:text-gray-400 border-2 border-dashed border-gray-300 dark:border-gray-600">
          <p className="mb-2 text-sm sm:text-base">No locations added yet</p>
          <p className="text-xs sm:text-sm">
            Click the + button to add locations
          </p>
        </div>
      )}

      <AddLocationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddLocation}
        locations={locations}
        onRemove={onRemoveLocation}
      />
    </div>
  );
}
