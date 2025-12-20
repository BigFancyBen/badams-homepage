# Claude Code Instructions

Personal homepage with Next.js 16, React 19, TypeScript, and Tailwind CSS. Contains three main apps: MTG Commander life tracker, Magic card tutor helper, and FloatWise weather tracker.

## Quick Commands

```bash
npm install          # Install dependencies (~15s)
npm run dev          # Start dev server with Turbopack (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint check
npm run type-check   # TypeScript check
```

## Pre-commit Validation

Always run before committing:
```bash
npm run lint && npm run type-check && npm run build
```

## Project Structure

```
app/
  page.tsx                    # Homepage
  layout.tsx                  # Root layout (fonts, metadata)
  globals.css                 # Global styles
  commander/                  # MTG life tracker app
    page.tsx, components/, hooks/, types.ts
  tutor-helper/               # Card filtering app
    page.tsx, components/, hooks/, types/, utils/
  floatwise/                  # Weather tracking app
    page.tsx, components/, hooks/, types.ts, utils.ts
  api/ably/                   # Ably realtime API route
```

## Key Architectural Decisions

- **State persistence**: All apps use localStorage via custom hooks
- **Styling**: Tailwind CSS, dark theme, no rounded corners
- **Fonts**: Local Geist fonts via `geist` package (not Google Fonts)
- **External APIs**: Scryfall (cards), NOAA (weather), OpenStreetMap (geocoding), Ably (realtime)
- **Mobile-first**: Responsive design with specific mobile layouts

## Type Definitions

- `app/commander/types.ts` - PlayerState, HistoryEntry, GameSettings
- `app/tutor-helper/types/index.ts` - Card, Deck types
- `app/floatwise/types.ts` - Weather, Location, Forecast types

## Common Patterns

### Custom Hooks
- `useLocalStorage` - Persistent state with localStorage
- `useWeatherData` - NOAA API fetching with caching
- `useAutocomplete` - Debounced search with OpenStreetMap

### Component Organization
- Page components in `page.tsx`
- Reusable UI in `components/`
- Business logic in `hooks/`
- Type definitions in `types.ts` or `types/`

## Validation Checklist

After changes, verify:
1. `npm run lint` passes
2. `npm run type-check` passes
3. `npm run build` succeeds
4. Dev server works: `npm run dev`
5. UI renders correctly at target route

## Network Dependencies

These external services may be unavailable in sandboxed environments:
- Scryfall API (tutor-helper card data)
- NOAA API (floatwise weather)
- OpenStreetMap Nominatim (floatwise geocoding)
- Ably (commander multiplayer)
