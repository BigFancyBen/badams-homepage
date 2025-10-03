import { useState } from "react";
import { LocationManagerProps, Location } from "../types";
import { AddLocationModal } from "./AddLocationModal";

export function LocationManager({
  locations,
  onAddLocation,
  onRemoveLocation,
  onReorderLocations,
  onRenameLocation,
  showShareButton,
  onShareClick,
  isViewingSharedLink,
}: LocationManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);

  const handleAddLocation = (location: Location) => {
    onAddLocation(location);
    setIsModalOpen(false);
  };

  const handleShareClick = async () => {
    if (onShareClick) {
      await onShareClick();
      setShowCopiedMessage(true);
      setTimeout(() => setShowCopiedMessage(false), 2000);
    }
  };

  return (
    <div className="">
      <div className="flex items-center gap-1 mb-3 sm:mb-4">
        {isViewingSharedLink && (
          <div className="text-[9px] text-gray-500 dark:text-gray-400 italic mr-2">
            viewing shared locations
          </div>
        )}
        {/* Share Button */}
        {showShareButton && onShareClick && (
          <div className="relative">
            <button
              onClick={handleShareClick}
              className="w-8 h-8 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center"
              title="Share locations"
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
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z"
                />
              </svg>
            </button>
            {showCopiedMessage && (
              <div className="absolute top-1/2 right-full mr-2 -translate-y-1/2 px-2 py-1 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded whitespace-nowrap z-50">
                Link copied!
              </div>
            )}
          </div>
        )}
        {/* Add Location Button */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-8 h-8 bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors flex items-center justify-center"
          title="Add location"
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
        onReorder={onReorderLocations}
        onRename={onRenameLocation}
      />
    </div>
  );
}
