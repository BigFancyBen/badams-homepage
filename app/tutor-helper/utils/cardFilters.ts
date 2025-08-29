import { MagicCard, CardFilters } from '../types';
import { cardMatchesTypeFilter } from './cardTypeUtils';

export function filterCards(cards: MagicCard[], filters: CardFilters): MagicCard[] {
  return cards.filter(card => {
    // Filter by mana cost
    if (filters.manaCosts.length > 0) {
      const cardCmc = card.cmc;
      const matchesManaCost = filters.manaCosts.some(filterCost => {
        if (filterCost === 7) {
          // 7+ mana cost
          return cardCmc >= 7;
        }
        return cardCmc === filterCost;
      });
      
      if (!matchesManaCost) {
        return false;
      }
    }

    // Combine both type filters (card type buttons + type search)
    const allTypeFilters = [...filters.cardTypes, ...filters.typeSearch];
    if (allTypeFilters.length > 0) {
      if (!cardMatchesTypeFilter(card, allTypeFilters, filters.typeLogic)) {
        return false;
      }
    }

    return true;
  });
}
