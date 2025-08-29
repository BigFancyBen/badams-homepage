'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { MagicCard } from '../types';
import { useLocalStorageCache } from './useLocalStorageCache';

// Create a hash-based key for card names (same as in useLocalStorageCache)
function createCardKey(cardName: string): string {
  const normalizedName = cardName.toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < normalizedName.length; i++) {
    const char = normalizedName.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `card_${Math.abs(hash).toString(36)}_${normalizedName.length}`;
}

// Simple heuristic to guess card type from name for fallback
function guessCardTypeFromName(name: string): string {
  const lowerName = name.toLowerCase();
  
  // Common land patterns
  if (lowerName.includes('land') || 
      lowerName.includes('plains') || 
      lowerName.includes('island') || 
      lowerName.includes('swamp') || 
      lowerName.includes('mountain') || 
      lowerName.includes('forest') ||
      lowerName.includes('tower') ||
      lowerName.includes('cave') ||
      lowerName.includes('gate')) {
    return 'Land';
  }
  
  // Common artifact patterns
  if (lowerName.includes('ring') || 
      lowerName.includes('sword') || 
      lowerName.includes('staff') || 
      lowerName.includes('orb') ||
      lowerName.includes('mox') ||
      lowerName.includes('lotus')) {
    return 'Artifact';
  }
  
  // Common enchantment patterns
  if (lowerName.includes('study') || 
      lowerName.includes('aura') || 
      lowerName.includes('curse') ||
      lowerName.includes('blessing')) {
    return 'Enchantment';
  }
  
  // Common planeswalker patterns
  if (lowerName.includes('jace') || 
      lowerName.includes('chandra') || 
      lowerName.includes('liliana') ||
      lowerName.includes('garruk') ||
      lowerName.includes('teferi')) {
    return 'Legendary Planeswalker';
  }
  
  // Default to creature
  return 'Creature';
}

export function useScryfall(cardNames: string[] = []) {
  const [cards, setCards] = useState<MagicCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { loadCachedCards, saveScryfallCards, isLoaded } = useLocalStorageCache();

  const fetchCardsFromScryfall = useCallback(async (names: string[]) => {
    if (!isLoaded) return;
    
    setLoading(true);
    setError(null);

    try {
      // Check cache first
      const { cached, missing } = loadCachedCards(names);
      console.log(`Cache hit: ${cached.length}/${names.length} cards, fetching ${missing.length} from API`);

      let allCards = [...cached];

      // Only fetch missing cards from API
      if (missing.length > 0) {
        const cardPromises = missing.slice(0, 100).map(async (searchTerm, index) => {
          try {
            const response = await fetch(
              `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(searchTerm)}`
            );
            
            if (response.ok) {
              const cardData = await response.json();
              console.log(`Fetched card: requested "${searchTerm}" -> got "${cardData.name}", Type: ${cardData.type_line}, CMC: ${cardData.cmc}`);
              // Use the original search term as the name for consistent hashing
              return {
                ...cardData,
                name: searchTerm
              };
            } else {
              console.warn(`Scryfall API failed for "${searchTerm}": ${response.status} ${response.statusText}`);
              // If card not found on Scryfall, create better placeholder by guessing type
              const guessedType = guessCardTypeFromName(searchTerm);
              return {
                id: `fallback-${Date.now()}-${index}`,
                name: searchTerm,
                mana_cost: '',
                cmc: 0,
                type_line: guessedType,
                image_uris: { 
                  small: '/placeholder-card.svg', 
                  normal: '/placeholder-card.svg', 
                  large: '/placeholder-card.svg' 
                }
              };
            }
          } catch {
            // Network error fallback
            const guessedType = guessCardTypeFromName(searchTerm);
            return {
              id: `fallback-${Date.now()}-${index}`,
              name: searchTerm,
              mana_cost: '',
              cmc: 0,
              type_line: guessedType,
              image_uris: { 
                small: '/placeholder-card.svg', 
                normal: '/placeholder-card.svg', 
                large: '/placeholder-card.svg' 
              }
            };
          }
        });

        const freshResults = await Promise.all(cardPromises);
        const validFreshCards = freshResults.filter(card => card !== null);
        
        // Cache the newly fetched cards with their search terms
        if (validFreshCards.length > 0) {
          const cardResults = validFreshCards.map((card, index) => ({
            searchTerm: missing[index],
            card
          }));
          saveScryfallCards(cardResults);
        }

        allCards = [...allCards, ...validFreshCards];
      }

      // Sort cards to match the original order and track missing ones
      const sortedCards = [];
      const missingCards = [];
      
      // Create a hash-based lookup map for efficient matching
      const cardLookupMap = new Map<string, MagicCard>();
      allCards.forEach(card => {
        const cardKey = createCardKey(card.name);
        cardLookupMap.set(cardKey, card);
      });

      for (const searchTerm of names) {
        const searchKey = createCardKey(searchTerm);
        const found = cardLookupMap.get(searchKey);
        
        if (found) {
          sortedCards.push(found);
          console.log(`Hash match: "${searchTerm}" -> "${found.name}" (key: ${searchKey})`);
        } else {
          missingCards.push(searchTerm);
          console.warn(`Card not found after API calls: "${searchTerm}" (key: ${searchKey})`);
        }
      }

      if (missingCards.length > 0) {
        console.warn(`Missing ${missingCards.length} cards:`, missingCards);
      }

      setCards(sortedCards);
      
      // Don't show cache info as errors, just log them
      if (missing.length === 0) {
        console.log(`Loaded ${cached.length} cards from cache (offline mode)`);
      } else if (cached.length > 0) {
        console.log(`Loaded ${cached.length} cards from cache, fetched ${missing.length} from API`);
      }
      
      setError(null);
    } catch (err) {
      console.error('Error fetching cards:', err);
      setError('Failed to fetch cards from Scryfall');
      setCards([]);
    } finally {
      setLoading(false);
    }
  }, [isLoaded, loadCachedCards, saveScryfallCards]);

  useEffect(() => {
    if (cardNames.length > 0) {
      fetchCardsFromScryfall(cardNames);
    } else {
      setCards([]);
      setLoading(false);
      setError(null);
    }
  }, [cardNames, fetchCardsFromScryfall]);

  const refetch = useCallback(() => {
    if (cardNames.length > 0) {
      fetchCardsFromScryfall(cardNames);
    }
  }, [cardNames, fetchCardsFromScryfall]);

  return { cards, loading, error, refetch };
}