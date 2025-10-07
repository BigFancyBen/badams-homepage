import { useState } from "react";
import { LocationManagerProps, Location } from "../types";
import { AddLocationModal } from "./AddLocationModal";
import { importLocationsFromCSV } from "../utils";

export function LocationManager({
  locations,
  onAddLocation,
  onRemoveLocation,
  onReorderLocations,
  onRenameLocation,
  showShareButton,
  onShareClick,
  isViewingSharedLink,
  onExportCSV,
  onExportCSVFile,
  onImportCSV,
}: LocationManagerProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showCopiedMessage, setShowCopiedMessage] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvInput, setCsvInput] = useState('');
  const [importError, setImportError] = useState('');

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

  const handleLoadMyData = () => {
    // Remove URL params to load user's own data
    window.location.href = window.location.pathname;
  };

  const handleExportCSV = async () => {
    if (onExportCSV) {
      await onExportCSV();
      setShowCopiedMessage(true);
      setTimeout(() => setShowCopiedMessage(false), 2000);
    }
  };

  const handleExportCSVFile = () => {
    if (onExportCSVFile) {
      onExportCSVFile();
    }
  };

  const handleImportCSV = () => {
    setShowImportModal(true);
    setCsvInput('');
    setImportError('');
  };

  const handleImportSubmit = () => {
    if (!onImportCSV) return;
    
    try {
      const importedLocations = importLocationsFromCSV(csvInput);
      
      if (importedLocations.length === 0) {
        setImportError('No valid locations found in CSV. Please check the format.');
        return;
      }
      
      onImportCSV(importedLocations);
      setShowImportModal(false);
      setCsvInput('');
      setImportError('');
    } catch (error) {
      setImportError('Error parsing CSV. Please check the format.');
      console.error('Import error:', error);
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
        {/* Import CSV Button */}
        {!isViewingSharedLink && onImportCSV && (
          <button
            onClick={handleImportCSV}
            className="w-8 h-8 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center"
            title="Import CSV"
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
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          </button>
        )}
        {/* Export CSV to Clipboard Button */}
        {!isViewingSharedLink && locations.length > 0 && onExportCSV && (
          <div className="relative">
            <button
              onClick={handleExportCSV}
              className="w-8 h-8 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center"
              title="Export CSV to clipboard"
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
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </button>
            {showCopiedMessage && (
              <div className="absolute top-1/2 right-full mr-2 -translate-y-1/2 px-2 py-1 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded whitespace-nowrap z-50">
                CSV copied!
              </div>
            )}
          </div>
        )}
        {/* Export CSV to File Button */}
        {!isViewingSharedLink && locations.length > 0 && onExportCSVFile && (
          <button
            onClick={handleExportCSVFile}
            className="w-8 h-8 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center"
            title="Download CSV file"
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
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </button>
        )}
        {/* Share or Load My Data Button */}
        {isViewingSharedLink ? (
          <button
            onClick={handleLoadMyData}
            className="w-auto px-2 h-8 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex items-center justify-center text-xs font-medium border border-gray-300 dark:border-gray-600"
            title="Load my data"
          >
            Load My Data
          </button>
        ) : showShareButton && onShareClick ? (
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
        ) : null}
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

      {/* Import CSV Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm"
            onClick={() => setShowImportModal(false)}
          />

          {/* Modal Content */}
          <div className="relative z-10 w-full max-w-2xl mx-4 bg-white dark:bg-gray-800 shadow-2xl">
            {/* Header */}
            <div className="bg-gray-100 dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Import Locations from CSV
                </h3>
                <button
                  onClick={() => setShowImportModal(false)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-6">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Paste CSV data with format: <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5">name,lat,lon</code>
              </p>
              <textarea
                value={csvInput}
                onChange={(e) => setCsvInput(e.target.value)}
                placeholder="name,lat,lon&#10;Harrison Arkansas,36.2298,-93.1077&#10;Seattle Washington,47.6062,-122.3321"
                className="w-full h-48 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {importError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {importError}
                </p>
              )}
            </div>

            {/* Footer */}
            <div className="bg-gray-100 dark:bg-gray-900 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImportSubmit}
                className="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
