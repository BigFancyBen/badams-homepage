import { useState, useEffect } from "react";
import {
  AddLocationModalProps,
  Location,
  LocationSearchResult,
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
}: AddLocationModalProps) {
  const [searchMode, setSearchMode] = useState<"city" | "coordinates">("city");
  const [name, setName] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [touchStartY, setTouchStartY] = useState<number | null>(null);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

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
    handleKeyDown,
    clearSuggestions,
    setIsOpen: setSuggestionsOpen,
  } = useAutocomplete();

  const resetForm = () => {
    clearSuggestions(); // This now clears the query completely
    setName("");
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
    setName(selected.name); // Auto-populated with "City, State" format
    setLat(selected.lat.toString());
    setLon(selected.lon.toString());
  };

  // Update error when search error occurs
  useEffect(() => {
    if (searchError) {
      setError(searchError);
    }
  }, [searchError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSubmitting(true);

    // Validate inputs based on search mode
    if (searchMode === "coordinates") {
      if (!name.trim()) {
        setError(
          "Location name is required when entering coordinates manually"
        );
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
      setError(
        "Latitude must be between -90 and 90, longitude between -180 and 180"
      );
      setIsSubmitting(false);
      return;
    }

    try {
      const location: Location = {
        id: generateLocationId(name.trim(), latitude, longitude),
        name: name.trim(),
        lat: latitude,
        lon: longitude,
      };

      onAdd(location);
      resetForm();
      // Close modal after successful addition
      onClose();
    } catch (err) {
      console.error("Error adding location:", err);
      setError("Failed to add location. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newLocations = [...locations];
    const draggedItem = newLocations[draggedIndex];
    
    // Remove from old position
    newLocations.splice(draggedIndex, 1);
    // Insert at new position
    newLocations.splice(dropIndex, 0, draggedItem);
    
    onReorder(newLocations);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  // Touch event handlers for mobile support
  const handleTouchStart = (e: React.TouchEvent, index: number) => {
    const touch = e.touches[0];
    setTouchStartY(touch.clientY);
    setDraggedIndex(index);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (draggedIndex === null || touchStartY === null) return;
    
    const touch = e.touches[0];
    
    // Find which element we're over
    const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
    const locationElement = elements.find(el => 
      el.hasAttribute('data-location-index')
    ) as HTMLElement;
    
    if (locationElement) {
      const overIndex = parseInt(locationElement.getAttribute('data-location-index') || '-1');
      if (overIndex !== -1 && overIndex !== draggedIndex) {
        setDragOverIndex(overIndex);
      }
    }
  };

  const handleTouchEnd = () => {
    if (draggedIndex === null || dragOverIndex === null) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      setTouchStartY(null);
      return;
    }

    if (draggedIndex !== dragOverIndex) {
      const newLocations = [...locations];
      const draggedItem = newLocations[draggedIndex];
      
      // Remove from old position
      newLocations.splice(draggedIndex, 1);
      // Insert at new position
      newLocations.splice(dragOverIndex, 0, draggedItem);
      
      onReorder(newLocations);
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
    setTouchStartY(null);
  };

  const handleStartEdit = (locationId: string, currentName: string) => {
    setEditingLocationId(locationId);
    setEditingName(currentName);
  };

  const handleCancelEdit = () => {
    setEditingLocationId(null);
    setEditingName("");
  };

  const handleSaveEdit = (locationId: string) => {
    if (editingName.trim()) {
      onRename(locationId, editingName.trim());
      setEditingLocationId(null);
      setEditingName("");
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, locationId: string) => {
    if (e.key === 'Enter') {
      handleSaveEdit(locationId);
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white dark:bg-gray-800 max-w-md w-full p-4 sm:p-6 border border-gray-200 dark:border-gray-700 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-3 sm:mb-4">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-gray-100">
            Add New Location
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-2xl"
          >
            ×
          </button>
        </div>

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
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
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
            className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
              searchMode === "coordinates"
                ? "bg-blue-500 dark:bg-blue-600 text-white"
                : "bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
            }`}
          >
            Enter Coordinates
          </button>
        </div>

        {/* Existing Locations */}
        {locations.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">
              Current Locations
            </h3>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {locations.map((location, index) => (
                <div
                  key={location.id}
                  data-location-index={index}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, index)}
                  onDragEnd={handleDragEnd}
                  onTouchStart={(e) => handleTouchStart(e, index)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                  className={`flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 transition-all cursor-move ${
                    draggedIndex === index ? 'opacity-50' : ''
                  } ${
                    dragOverIndex === index && draggedIndex !== index
                      ? 'border-blue-500 dark:border-blue-400 border-t-2'
                      : ''
                  }`}
                  style={{
                    touchAction: 'none',
                    userSelect: 'none',
                  }}
                >
                  <div className="flex items-center flex-1">
                    {/* Drag Handle */}
                    <div className="mr-3 text-gray-400 dark:text-gray-500">
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
                          d="M4 8h16M4 16h16"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      {editingLocationId === location.id ? (
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => handleEditKeyDown(e, location.id)}
                          onBlur={() => handleSaveEdit(location.id)}
                          className="w-full px-2 py-1 border border-blue-500 dark:border-blue-400 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                      ) : (
                        <div className="font-medium text-gray-900 dark:text-gray-100">
                          {location.name}
                        </div>
                      )}
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {location.lat.toFixed(4)}, {location.lon.toFixed(4)}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleStartEdit(location.id, location.name)}
                      className="p-1 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                      title="Rename location"
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
                          d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => onRemove(location.id)}
                      className="p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                      title="Remove location"
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
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
                  onKeyDown={handleKeyDown}
                  onFocus={() => setSuggestionsOpen(true)}
                  placeholder="e.g., Harrison, Arkansas"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSubmitting}
                  autoComplete="off"
                />
                {isSearching && (
                  <div className="absolute right-3 top-2">
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
                      className={`w-full text-left px-3 py-2 border-b border-gray-100 dark:border-gray-600 last:border-b-0 focus:outline-none text-gray-900 dark:text-gray-100 ${
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
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSubmitting}
              />
            </div>
          )}

          {searchMode === "city" && name && (
            <div className="bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700 p-3 text-sm text-blue-800 dark:text-blue-200">
              <strong>Selected location:</strong> {name}
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
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="35.1234"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  placeholder="-93.5678"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={isSubmitting}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="text-red-600 dark:text-red-400 text-sm bg-red-50 dark:bg-red-900 border border-red-200 dark:border-red-700 p-2">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 transition-colors disabled:opacity-50"
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
  );
}
