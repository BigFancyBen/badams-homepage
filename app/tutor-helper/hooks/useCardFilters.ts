'use client';

import { useState, useCallback } from 'react';
import { CardFilters } from '../types';

export function useCardFilters() {
  const [filters, setFilters] = useState<CardFilters>({
    manaCosts: [],
    cardTypes: [],
    typeLogic: 'and',
    typeSearch: []
  });

  const toggleManaCost = useCallback((cost: number) => {
    setFilters(prev => ({
      ...prev,
      manaCosts: prev.manaCosts.includes(cost)
        ? prev.manaCosts.filter(c => c !== cost)
        : [...prev.manaCosts, cost]
    }));
  }, []);

  const toggleCardType = useCallback((type: string) => {
    setFilters(prev => ({
      ...prev,
      cardTypes: prev.cardTypes.includes(type)
        ? prev.cardTypes.filter(t => t !== type)
        : [...prev.cardTypes, type]
    }));
  }, []);

  const toggleTypeLogic = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      typeLogic: prev.typeLogic === 'and' ? 'or' : 'and'
    }));
  }, []);

  const toggleTypeSearch = useCallback((types: string[]) => {
    setFilters(prev => ({
      ...prev,
      typeSearch: types
    }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({
      manaCosts: [],
      cardTypes: [],
      typeLogic: 'and',
      typeSearch: []
    });
  }, []);

  return {
    filters,
    toggleManaCost,
    toggleCardType,
    toggleTypeLogic,
    toggleTypeSearch,
    resetFilters
  };
}
