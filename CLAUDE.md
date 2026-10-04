# Claude Code Instructions

Personal homepage with Next.js 16, React 19, TypeScript, and Tailwind CSS. Requires Node >= 22. Contains multiple apps: MTG Commander life tracker, Magic card tutor helper, FloatWise weather tracker, Dota hero randomizer, and token helper.

## Quick Commands

```bash
npm install          # Install dependencies (~15s)
npm run dev          # Start dev server with Turbopack (http://localhost:3000)
npm run build        # Production build
npm run lint         # ESLint check
npm run type-check   # TypeScript check
npm test             # Playwright e2e tests
npm run test:ui      # Playwright interactive UI mode
npm run test:headed  # Run tests in headed browser
npm run test:debug   # Debug tests with Playwright inspector
```

## Pre-commit Validation

Husky pre-commit hook automatically runs:
```bash
npm run lint && npm run type-check
```

## Project Structure

```
app/
  page.tsx                    # Homepage
  layout.tsx                  # Root layout (fonts, metadata)
  globals.css                 # Global styles
  components/homepage/        # Shared homepage components
  hooks/                      # Shared hooks (useGyroscope, useMobileDevice, useReducedMotion)
  resume/                     # Resume page
  commander/                  # MTG life tracker app
    page.tsx, components/, hooks/, types.ts
  tutor-helper/               # Card filtering app
    page.tsx, components/, hooks/, types/, utils/
  floatwise/                  # Weather tracking app
    page.tsx, components/, hooks/, types.ts, utils.ts
  dota-randomizer/            # Dota hero randomizer app
    page.tsx, components/, hooks/, types.ts
  token-helper/               # Token helper app
    page.tsx, components/, hooks/, types.ts, utils/
  api/ably/                   # Ably realtime API route
e2e/                          # Playwright e2e tests
```

## Key Architectural Decisions

- **State persistence**: All apps use localStorage via custom hooks
- **Styling**: Tailwind CSS, dark theme, no rounded corners
- **Fonts**: Inter via `next/font/google` (downloaded at build and self-hosted — no request to Google at runtime) and Geist Mono via the `geist` package
- **Images**: no `images.remotePatterns` — remote images (Scryfall, Steam, devicons, QR codes) render `unoptimized`; only files in `/public` go through the optimizer. See the note in `next.config.ts`
- **Security headers**: set for every route in `next.config.ts`
- **Animation**: `motion` library (Framer Motion) for page transitions and UI animations
- **External APIs**: Scryfall (cards), Open-Meteo (weather), OpenStreetMap (geocoding), Ably (realtime)
- **Mobile-first**: Responsive design with specific mobile layouts

## Type Definitions

- `app/commander/types.ts` - PlayerState, HistoryEntry, GameSettings
- `app/tutor-helper/types/index.ts` - Card, Deck types
- `app/floatwise/types.ts` - Weather, Location, Forecast types

## Common Patterns

### Custom Hooks
- `useLocalStorage` - Persistent state with localStorage
- `useWeatherData` - Open-Meteo API fetching with caching
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
- Open-Meteo API (floatwise weather)
- OpenStreetMap Nominatim (floatwise geocoding)
- Ably (commander multiplayer)

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
