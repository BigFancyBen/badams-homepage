import { useState } from "react";
import { Location } from "../types";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  locations: Location[];
  onImportLocations: (locations: Location[]) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  locations,
  onImportLocations,
}: SettingsModalProps) {
  const [jsonInput, setJsonInput] = useState("");
  const [importError, setImportError] = useState("");
  const [showExportCopied, setShowExportCopied] = useState(false);

  if (!isOpen) return null;

  const handleExportToClipboard = async () => {
    try {
      const config = {
        locations: locations,
        version: "1.0",
        exportDate: new Date().toISOString(),
      };
      const json = JSON.stringify(config, null, 2);
      await navigator.clipboard.writeText(json);
      setShowExportCopied(true);
      setTimeout(() => setShowExportCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const handleExportToFile = () => {
    const config = {
      locations: locations,
      version: "1.0",
      exportDate: new Date().toISOString(),
    };
    const json = JSON.stringify(config, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const timestamp = new Date().toISOString().slice(0, 10);
    link.download = `floatwise-config-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      
      // Validate the structure
      if (!parsed.locations || !Array.isArray(parsed.locations)) {
        setImportError("Invalid format: 'locations' array is required");
        return;
      }

      // Validate each location
      const validLocations = parsed.locations.filter((loc: Location) => {
        return (
          loc.id &&
          loc.name &&
          typeof loc.lat === "number" &&
          typeof loc.lon === "number" &&
          loc.lat >= -90 &&
          loc.lat <= 90 &&
          loc.lon >= -180 &&
          loc.lon <= 180
        );
      });

      if (validLocations.length === 0) {
        setImportError("No valid locations found in JSON");
        return;
      }

      onImportLocations(validLocations);
      setJsonInput("");
      setImportError("");
      onClose();
    } catch (error) {
      setImportError("Invalid JSON format. Please check your input.");
      console.error("Import error:", error);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative z-10 w-full max-w-3xl mx-4 bg-white dark:bg-gray-800 shadow-2xl">
        {/* Header */}
        <div className="bg-gray-100 dark:bg-gray-900 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Settings
            </h3>
            <button
              onClick={onClose}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl"
            >
              ×
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {/* Export Section */}
          <div className="mb-6">
            <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">
              Export Configuration
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Export all your locations and settings as JSON
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleExportToClipboard}
                className="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                Copy to Clipboard
              </button>
              <button
                onClick={handleExportToFile}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
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
                Download File
              </button>
              {showExportCopied && (
                <div className="flex items-center text-sm text-green-600 dark:text-green-400">
                  Copied to clipboard!
                </div>
              )}
            </div>
          </div>

          {/* Import Section */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">
              Import Configuration
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
              Paste your JSON configuration to import locations
            </p>
            <textarea
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder='{\n  "locations": [\n    {\n      "id": "...",\n      "name": "Seattle",\n      "lat": 47.6062,\n      "lon": -122.3321\n    }\n  ]\n}'
              className="w-full h-48 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {importError && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                {importError}
              </p>
            )}
            <div className="mt-4">
              <button
                onClick={handleImport}
                className="px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors"
              >
                Import
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
