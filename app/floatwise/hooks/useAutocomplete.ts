import { useState, useEffect, useCallback, useRef } from 'react';
import { LocationSearchResult } from '../types';
import { searchLocationByName, formatCityState, debounce } from '../utils';

export function useAutocomplete() {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<LocationSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const abortControllerRef = useRef<AbortController | null>(null);

  // Debounced search function
  const debouncedSearch = useCallback(
    debounce(async (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setSuggestions([]);
        setIsOpen(false);
        setIsLoading(false);
        return;
      }

      // Abort previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      try {
        setIsLoading(true);
        setError('');
        
        const results = await searchLocationByName(searchQuery);
        
        // Only update if this request wasn't aborted
        if (!abortControllerRef.current?.signal.aborted) {
          const formattedResults: LocationSearchResult[] = results.map(result => ({
            name: formatCityState(result.display_name),
            displayName: result.display_name,
            lat: parseFloat(result.lat),
            lon: parseFloat(result.lon)
          }));
          
          setSuggestions(formattedResults);
          setIsOpen(formattedResults.length > 0);
          setHighlightedIndex(-1);
        }
      } catch (error) {
        if (!abortControllerRef.current?.signal.aborted) {
          console.error('Autocomplete search error:', error);
          setError('Search failed. Please try again.');
          setSuggestions([]);
          setIsOpen(false);
        }
      } finally {
        if (!abortControllerRef.current?.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 500), // 500ms debounce for better performance
    []
  );

  // Effect to trigger search when query changes
  useEffect(() => {
    debouncedSearch(query);
    
    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, debouncedSearch]);

  const handleInputChange = (value: string) => {
    setQuery(value);
  };

  const handleSelectSuggestion = (suggestion: LocationSearchResult) => {
    setQuery(suggestion.name);
    setIsOpen(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
    return suggestion;
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHighlightedIndex(prev => 
          prev < suggestions.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlightedIndex(prev => prev > 0 ? prev - 1 : prev);
        break;
      case 'Enter':
        event.preventDefault();
        if (highlightedIndex >= 0) {
          const selected = suggestions[highlightedIndex];
          return handleSelectSuggestion(selected);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setHighlightedIndex(-1);
        break;
    }
  };

  const clearSuggestions = () => {
    setQuery('');
    setIsOpen(false);
    setSuggestions([]);
    setHighlightedIndex(-1);
    setError('');
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  return {
    query,
    suggestions,
    isLoading,
    isOpen,
    error,
    highlightedIndex,
    handleInputChange,
    handleSelectSuggestion,
    handleKeyDown,
    clearSuggestions,
    setIsOpen
  };
}