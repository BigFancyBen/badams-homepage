"use client";

import { useState, useRef, useEffect } from "react";
import { UserPreferences, Location } from "../types";
import {
  DEFAULT_PREFERENCES,
  parseLocationCSV,
  exportConfigJSON,
  parseConfigJSON,
} from "../utils";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  onUpdatePreferences: (prefs: UserPreferences) => void;
  locations: Location[];
  onImportLocations: (locations: Location[]) => void;
  onReplaceAll: (locations: Location[], preferences: UserPreferences) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  preferences,
  onUpdatePreferences,
  locations,
  onImportLocations,
  onReplaceAll,
}: SettingsModalProps) {
  const [tempThreshold, setTempThreshold] = useState(
    preferences.temperatureThreshold
  );
  const [precipThreshold, setPrecipThreshold] = useState(
    preferences.precipThreshold
  );
  const [windThreshold, setWindThreshold] = useState(
    preferences.windSpeedThreshold
  );

  // CSV import state
  const [csvText, setCsvText] = useState("");
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvSuccess, setCsvSuccess] = useState("");
  const csvFileRef = useRef<HTMLInputElement>(null);

  // JSON import state
  const [jsonImportError, setJsonImportError] = useState("");
  const [jsonImportSuccess, setJsonImportSuccess] = useState("");
  const jsonFileRef = useRef<HTMLInputElement>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState<
    "thresholds" | "csv" | "exportimport"
  >("thresholds");

  // Sync local state when preferences prop changes
  useEffect(() => {
    setTempThreshold(preferences.temperatureThreshold);
    setPrecipThreshold(preferences.precipThreshold);
    setWindThreshold(preferences.windSpeedThreshold);
  }, [preferences]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleSavePreferences = () => {
    onUpdatePreferences({
      temperatureThreshold: tempThreshold,
      precipThreshold: precipThreshold,
      windSpeedThreshold: windThreshold,
    });
  };

  const handleResetDefaults = () => {
    setTempThreshold(DEFAULT_PREFERENCES.temperatureThreshold);
    setPrecipThreshold(DEFAULT_PREFERENCES.precipThreshold);
    setWindThreshold(DEFAULT_PREFERENCES.windSpeedThreshold);
    onUpdatePreferences(DEFAULT_PREFERENCES);
  };

  // CSV Import
  const handleCsvFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      setCsvErrors([]);
      setCsvSuccess("");
    };
    reader.readAsText(file);
  };

  const handleCsvImport = () => {
    setCsvErrors([]);
    setCsvSuccess("");
    const { locations: parsed, errors } = parseLocationCSV(csvText);
    if (errors.length > 0) {
      setCsvErrors(errors);
    }
    if (parsed.length > 0) {
      onImportLocations(parsed);
      setCsvSuccess(`Successfully imported ${parsed.length} location${parsed.length > 1 ? "s" : ""}`);
      setCsvText("");
      if (csvFileRef.current) csvFileRef.current.value = "";
    } else if (errors.length === 0) {
      setCsvErrors(["No valid locations found in CSV data"]);
    }
  };

  // JSON Export
  const handleJsonExport = () => {
    const json = exportConfigJSON(locations, preferences);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "floatwise-config.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // JSON Import
  const handleJsonFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setJsonImportError("");
    setJsonImportSuccess("");
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const result = parseConfigJSON(text);
      if (!result) {
        setJsonImportError(
          "Invalid config file. Expected JSON with locations array and optional preferences."
        );
        return;
      }
      onReplaceAll(result.locations, result.preferences);
      setJsonImportSuccess(
        `Imported ${result.locations.length} location${result.locations.length !== 1 ? "s" : ""} and preferences`
      );
      if (jsonFileRef.current) jsonFileRef.current.value = "";
    };
    reader.readAsText(file);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 max-w-md w-full border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-4 sm:p-6 pb-3 sm:pb-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
            Settings
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl leading-none p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 dark:border-gray-700 shrink-0">
          {(
            [
              { id: "thresholds", label: "Thresholds" },
              { id: "csv", label: "CSV Import" },
              { id: "exportimport", label: "Export/Import" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2 text-sm font-medium transition-colors min-h-[44px] ${
                activeTab === tab.id
                  ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-500"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 pt-4">
          {/* Thresholds Tab */}
          {activeTab === "thresholds" && (
            <div className="space-y-5">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Values below/above these thresholds will be highlighted in red.
              </p>

              {/* Temperature */}
              <div>
                <label
                  htmlFor="tempThreshold"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                >
                  Temperature threshold (°F)
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Temperatures below this value show as red
                </p>
                <input
                  id="tempThreshold"
                  type="number"
                  inputMode="numeric"
                  value={tempThreshold}
                  onChange={(e) =>
                    setTempThreshold(parseInt(e.target.value) || 0)
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
              </div>

              {/* Precipitation */}
              <div>
                <label
                  htmlFor="precipThreshold"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                >
                  Precipitation threshold (%)
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Precipitation above this value shows as red
                </p>
                <input
                  id="precipThreshold"
                  type="number"
                  inputMode="numeric"
                  value={precipThreshold}
                  onChange={(e) =>
                    setPrecipThreshold(parseInt(e.target.value) || 0)
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
              </div>

              {/* Wind Speed */}
              <div>
                <label
                  htmlFor="windThreshold"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                >
                  Wind speed threshold (mph)
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Wind speeds above this value show as red
                </p>
                <input
                  id="windThreshold"
                  type="number"
                  inputMode="numeric"
                  value={windThreshold}
                  onChange={(e) =>
                    setWindThreshold(parseInt(e.target.value) || 0)
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleResetDefaults}
                  className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-h-[44px]"
                >
                  Reset Defaults
                </button>
                <button
                  type="button"
                  onClick={handleSavePreferences}
                  className="flex-1 px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors min-h-[44px]"
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* CSV Import Tab */}
          {activeTab === "csv" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Import locations from a CSV file. Expected format:
              </p>
              <div className="bg-gray-50 dark:bg-gray-700 p-3 text-xs font-mono text-gray-700 dark:text-gray-300">
                name, subtitle, latitude, longitude
                <br />
                Buffalo Point, MM 2.4, 35.994, -92.856
                <br />
                Ponca, MM 64, 36.0408, -93.3656
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Subtitle column is optional. 3-column format (name, lat, lon)
                also works.
              </p>

              {/* File upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Upload CSV file
                </label>
                <input
                  ref={csvFileRef}
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleCsvFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => csvFileRef.current?.click()}
                  className="w-full px-4 py-2 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-h-[44px] text-sm"
                >
                  Browse CSV File...
                </button>
              </div>

              {/* Or paste text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                  Or paste CSV data
                </label>
                <textarea
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  placeholder="Buffalo Point, MM 2.4, 35.994, -92.856"
                  rows={5}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                />
              </div>

              {csvErrors.length > 0 && (
                <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 p-2">
                  {csvErrors.map((err, i) => (
                    <div key={i}>{err}</div>
                  ))}
                </div>
              )}

              {csvSuccess && (
                <div className="text-green-700 dark:text-green-400 text-sm bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 p-2">
                  {csvSuccess}
                </div>
              )}

              <button
                type="button"
                onClick={handleCsvImport}
                disabled={!csvText.trim()}
                className="w-full px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors disabled:opacity-50 min-h-[44px]"
              >
                Import CSV
              </button>
            </div>
          )}

          {/* Export/Import Tab */}
          {activeTab === "exportimport" && (
            <div className="space-y-5">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Export your locations and settings as a JSON file to share with
                others, or import a shared config file.
              </p>

              {/* Export */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Export Configuration
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  Downloads a JSON file with all {locations.length} location
                  {locations.length !== 1 ? "s" : ""} and your preferences.
                </p>
                <button
                  type="button"
                  onClick={handleJsonExport}
                  disabled={locations.length === 0}
                  className="w-full px-4 py-2 bg-green-600 dark:bg-green-700 text-white hover:bg-green-700 dark:hover:bg-green-800 transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  Export Config (.json)
                </button>
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700" />

              {/* Import */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                  Import Configuration
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                  <strong>Warning:</strong> This will replace all current
                  locations and preferences with the imported data.
                </p>
                <input
                  ref={jsonFileRef}
                  type="file"
                  accept=".json"
                  onChange={handleJsonFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => jsonFileRef.current?.click()}
                  className="w-full px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors min-h-[44px] text-sm"
                >
                  Import JSON Config...
                </button>
              </div>

              {jsonImportError && (
                <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 p-2">
                  {jsonImportError}
                </div>
              )}

              {jsonImportSuccess && (
                <div className="text-green-700 dark:text-green-400 text-sm bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 p-2">
                  {jsonImportSuccess}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
