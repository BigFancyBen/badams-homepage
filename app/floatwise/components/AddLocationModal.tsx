import { useState, useEffect } from "react";
import {
  AddLocationModalProps,
  Location,
  LocationSearchResult,
  WIND_DIRECTIONS,
} from "../types";
import { generateLocationId, isValidCoordinate } from "../utils";
import { useAutocomplete } from "../hooks/useAutocomplete";

export function AddLocationModal({
  isOpen,
  onClose,
  onAdd,
  locations,
  onRemove,
  onReorder,
  onRename,
  onUpdateLocation,
  onImportLocations: _onImportLocations,
}: AddLocationModalProps) {
  const [searchMode, setSearchMode] = useState<"city" | "coordinates">("city");
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [preferredWind, setPreferredWind] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingSubtitle, setEditingSubtitle] = useState("");
  const [editingWind, setEditingWind] = useState("");

  // Autocomplete hook for city search
  const {
    query: cityQuery,
    suggestions,
    isLoading: isSearching,
    isOpen: suggestionsOpen,
    error: searchError,
    highlightedIndex,
    handleInputChange,
    handleSelectSuggestion,
    handleKeyDown: handleAutocompleteKeyDown,
    clearSuggestions,
    setIsOpen: setSuggestionsOpen,
  } = useAutocomplete();

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

  const resetForm = () => {
    clearSuggestions();
    setName("");
    setSubtitle("");
    setPreferredWind("");
    setLat("");
    setLon("");
    setError("");
    setIsSubmitting(false);
    setSearchMode("city");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSelectAutocomplete = (result: LocationSearchResult) => {
    const selected = handleSelectSuggestion(result);
    setName(selected.name);
    setLat(selected.lat.toString());
    setLon(selected.lon.toString());
  };

  // Compute displayed error - use form error if set, otherwise search error
  const displayedError = error || searchError;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    // Validate inputs based on search mode
    if (searchMode === "coordinates") {
      if (!name.trim()) {
        setError("Location name is required when entering coordinates manually");
        setIsSubmitting(false);
        return;
      }
    } else if (searchMode === "city") {
      if (!name || !lat || !lon) {
        setError("Please search for and select a city first");
        setIsSubmitting(false);
        return;
      }
    }

    const latitude = parseFloat(lat);
    const longitude = parseFloat(lon);

    if (isNaN(latitude) || isNaN(longitude)) {
      setError("Please enter valid latitude and longitude values");
      setIsSubmitting(false);
      return;
    }

    if (!isValidCoordinate(latitude, longitude)) {
      setError("Latitude must be between -90 and 90, longitude between -180 and 180");
      setIsSubmitting(false);
      return;
    }

    try {
      const location: Location = {
        id: generateLocationId(name.trim(), latitude, longitude),
        name: name.trim(),
        lat: latitude,
        lon: longitude,
        subtitle: subtitle.trim() || undefined,
        preferredWindDirection: preferredWind || undefined,
      };

      onAdd(location);
      resetForm();
      onClose();
    } catch (err) {
      console.error("Error adding location:", err);
      setError("Failed to add location. Please try again.");
      setIsSubmitting(false);
    }
  };

  // Move location up/down (replaces drag-and-drop for reliable mobile usage)
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    const newLocations = [...locations];
    [newLocations[index - 1], newLocations[index]] = [newLocations[index], newLocations[index - 1]];
    onReorder(newLocations);
  };

  const handleMoveDown = (index: number) => {
    if (index >= locations.length - 1) return;
    const newLocations = [...locations];
    [newLocations[index], newLocations[index + 1]] = [newLocations[index + 1], newLocations[index]];
    onReorder(newLocations);
  };

  const handleStartEdit = (location: Location) => {
    setEditingLocationId(location.id);
    setEditingName(location.name);
    setEditingSubtitle(location.subtitle || "");
    setEditingWind(location.preferredWindDirection || "");
  };

  const handleCancelEdit = () => {
    setEditingLocationId(null);
    setEditingName("");
    setEditingSubtitle("");
    setEditingWind("");
  };

  const handleSaveEdit = (locationId: string) => {
    if (editingName.trim()) {
      onRename(locationId, editingName.trim());
      onUpdateLocation(locationId, {
        subtitle: editingSubtitle.trim() || undefined,
        preferredWindDirection: editingWind || undefined,
      });
      setEditingLocationId(null);
      setEditingName("");
      setEditingSubtitle("");
      setEditingWind("");
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, locationId: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSaveEdit(locationId);
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  // Handle Enter key in city search mode
  const handleCityKeyDown = (e: React.KeyboardEvent) => {
    // Let autocomplete handle its own keys first
    if (suggestionsOpen && suggestions.length > 0) {
      handleAutocompleteKeyDown(e);
      return;
    }
    // If Enter pressed with a selected location, submit form
    if (e.key === "Enter" && name && lat && lon) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 max-w-md w-full border border-gray-200 dark:border-gray-700 max-h-[90vh] flex flex-col">
        {/* Fixed Header */}
        <div className="flex justify-between items-center p-4 sm:p-6 pb-3 sm:pb-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
            Add New Location
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl leading-none p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            ×
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-4 sm:p-6 pt-3 floatwise-scroll">
          {/* Search Mode Toggle */}
          <div className="flex border border-gray-300 dark:border-gray-600 mb-4">
            <button
              type="button"
              onClick={() => {
                setSearchMode("city");
                clearSuggestions();
                setName("");
                setLat("");
                setLon("");
                setError("");
              }}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors min-h-[44px] ${
                searchMode === "city"
                  ? "bg-blue-500 dark:bg-blue-600 text-white"
                  : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
              }`}
            >
              Search by City
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchMode("coordinates");
                clearSuggestions();
                setName("");
                setLat("");
                setLon("");
                setError("");
              }}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors min-h-[44px] ${
                searchMode === "coordinates"
                  ? "bg-blue-500 dark:bg-blue-600 text-white"
                  : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
              }`}
            >
              Enter Coordinates
            </button>
          </div>

          {/* Existing Locations with visible scrollbar */}
          {locations.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
                Current Locations
              </h3>
              <div className="space-y-2 max-h-60 overflow-y-auto floatwise-scroll pr-1">
                {locations.map((location, index) => (
                  <div
                    key={location.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      {/* Up/Down Buttons */}
                      <div className="flex flex-col mr-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(index)}
                          disabled={index === 0}
                          className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 min-w-[32px] min-h-[28px] flex items-center justify-center"
                          title="Move up"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(index)}
                          disabled={index >= locations.length - 1}
                          className="p-1 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30 min-w-[32px] min-h-[28px] flex items-center justify-center"
                          title="Move down"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      </div>

                      <div className="flex-1 min-w-0">
                        {editingLocationId === location.id ? (
                          <div className="space-y-2">
                            {/* Edit Name */}
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => handleEditKeyDown(e, location.id)}
                              className="w-full px-2 py-1 border border-blue-500 dark:border-blue-400 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm min-h-[36px]"
                              placeholder="Location name"
                              autoFocus
                            />
                            {/* Edit Subtitle */}
                            <input
                              type="text"
                              value={editingSubtitle}
                              onChange={(e) => setEditingSubtitle(e.target.value)}
                              onKeyDown={(e) => handleEditKeyDown(e, location.id)}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm min-h-[36px]"
                              placeholder="Subtitle / Mile Marker (optional)"
                            />
                            {/* Edit Preferred Wind */}
                            <select
                              value={editingWind}
                              onChange={(e) => setEditingWind(e.target.value)}
                              className="w-full px-2 py-1 border border-gray-300 dark:border-gray-500 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-sm min-h-[36px]"
                            >
                              <option value="">No preferred wind</option>
                              {WIND_DIRECTIONS.map((dir) => (
                                <option key={dir} value={dir}>{dir}</option>
                              ))}
                            </select>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(location.id)}
                                className="px-3 py-1 bg-blue-500 text-white text-sm hover:bg-blue-600 min-h-[36px]"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={handleCancelEdit}
                                className="px-3 py-1 border border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-200 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 min-h-[36px]"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="font-medium text-gray-900 dark:text-gray-100 truncate">
                              {location.name}
                            </div>
                            {location.subtitle && (
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {location.subtitle}
                              </div>
                            )}
                            {location.preferredWindDirection && (
                              <div className="text-xs text-blue-500 dark:text-blue-400">
                                Preferred wind: {location.preferredWindDirection}
                              </div>
                            )}
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                    {editingLocationId !== location.id && (
                      <div className="flex items-center gap-1 ml-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(location)}
                          className="p-2 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                          title="Edit location"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemove(location.id)}
                          className="p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                          title="Remove location"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-200 dark:border-gray-600 mt-4 pt-4">
                <h4 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-3">
                  Add New Location
                </h4>
              </div>
            </div>
          )}

          {/* City Search Mode */}
          {searchMode === "city" && (
            <div className="space-y-4 mb-4">
              <div className="relative">
                <label
                  htmlFor="cityQuery"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                >
                  Search for City
                </label>
                <div className="relative">
                  <input
                    id="cityQuery"
                    type="text"
                    value={cityQuery}
                    onChange={(e) => handleInputChange(e.target.value)}
                    onKeyDown={handleCityKeyDown}
                    onFocus={() => setSuggestionsOpen(true)}
                    placeholder="e.g., Harrison, Arkansas"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                    disabled={isSubmitting}
                    autoComplete="off"
                  />
                  {isSearching && (
                    <div className="absolute right-3 top-3">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                </div>

                {/* Autocomplete Suggestions */}
                {suggestionsOpen && suggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 max-h-60 overflow-y-auto shadow-lg">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => handleSelectAutocomplete(suggestion)}
                        className={`w-full text-left px-3 py-2 border-b border-gray-100 dark:border-gray-600 last:border-b-0 focus:outline-hidden text-gray-900 dark:text-gray-100 min-h-[44px] ${
                          index === highlightedIndex
                            ? "bg-blue-50 dark:bg-blue-900"
                            : "hover:bg-gray-50 dark:hover:bg-gray-600"
                        }`}
                      >
                        <div className="font-medium">{suggestion.name}</div>
                        <div className="text-sm text-gray-600 dark:text-gray-300 truncate">
                          {suggestion.displayName}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {suggestion.lat.toFixed(4)}, {suggestion.lon.toFixed(4)}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {suggestions.length === 0 && cityQuery.trim().length >= 2 && !isSearching && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    No locations found. Try a different search term or use &ldquo;Enter Coordinates&rdquo; mode.
                  </div>
                )}

                {cityQuery.trim().length > 0 && cityQuery.trim().length < 2 && (
                  <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Type at least 2 characters to search for locations.
                  </div>
                )}
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {searchMode === "coordinates" && (
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                >
                  Location Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Buffalo National River"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                  disabled={isSubmitting}
                />
              </div>
            )}

            {searchMode === "city" && name && (
              <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 p-3 text-sm text-blue-800 dark:text-blue-200">
                <strong>Selected location:</strong> {name}
              </div>
            )}

            {/* Subtitle / Mile Marker (both modes) */}
            {(searchMode === "coordinates" || (searchMode === "city" && name)) && (
              <div>
                <label
                  htmlFor="subtitle"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                >
                  Subtitle / Mile Marker
                  <span className="text-gray-400 font-normal"> (optional)</span>
                </label>
                <input
                  id="subtitle"
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  placeholder="e.g., MM 2.4"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                  disabled={isSubmitting}
                />
              </div>
            )}

            {/* Preferred Wind Direction (both modes) */}
            {(searchMode === "coordinates" || (searchMode === "city" && name)) && (
              <div>
                <label
                  htmlFor="preferredWind"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                >
                  Preferred Wind Direction
                  <span className="text-gray-400 font-normal"> (optional)</span>
                </label>
                <select
                  id="preferredWind"
                  value={preferredWind}
                  onChange={(e) => setPreferredWind(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                  disabled={isSubmitting}
                >
                  <option value="">None</option>
                  {WIND_DIRECTIONS.map((dir) => (
                    <option key={dir} value={dir}>{dir}</option>
                  ))}
                </select>
              </div>
            )}

            {searchMode === "coordinates" && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="lat"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    Latitude
                  </label>
                  <input
                    id="lat"
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="35.1234"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label
                    htmlFor="lon"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
                  >
                    Longitude
                  </label>
                  <input
                    id="lon"
                    type="number"
                    step="any"
                    inputMode="decimal"
                    value={lon}
                    onChange={(e) => setLon(e.target.value)}
                    placeholder="-93.5678"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500 min-h-[44px]"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            )}

            {displayedError && (
              <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 p-2">
                {displayedError}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors min-h-[44px]"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors disabled:opacity-50 min-h-[44px]"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Adding..." : "Add Location"}
              </button>
            </div>
          </form>

          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            <p className="mb-1">
              <strong>Tip:</strong> Use &ldquo;Search by City&rdquo; to find
              locations easily, or &ldquo;Enter Coordinates&rdquo; for precise
              locations (find coordinates on Google Maps by right-clicking).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
