# badams-homepage Development Guide

Personal homepage and project showcase featuring web development tools and utilities. This is a Next.js 15.5.0 application with TypeScript, React 19, and Tailwind CSS, containing three main interactive applications: an MTG Commander scorekeeper, a Magic card tutor helper, and a NOAA weather tracking application for outdoor activities.

**ALWAYS reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.**

## Working Effectively

### Bootstrap and Setup

- `npm install` -- Installs all dependencies. Takes ~35 seconds. NEVER CANCEL. Set timeout to 60+ minutes.
- Check Node.js version: The project works with Node.js 16+ (uses package.json with Next.js 15.5.0)

### Development Workflow

- **ALWAYS run the development server for testing changes:**
  - `npm run dev` -- Starts development server with Turbopack. Takes ~1 second. Runs on http://localhost:3000
  - The server supports hot reload and is the primary way to test changes
- **NEVER try to build for production** -- Build fails due to network restrictions (Google Fonts blocked). See Build Limitations section below.
- Linting: `npm run lint` -- Takes ~5 seconds. Uses ESLint with Next.js config.
- Type checking: `npm run type-check` -- Takes ~3 seconds. Uses TypeScript compiler.
- **Pre-commit validation**: `npm run lint && npm run type-check` -- Always run before committing changes.

### Build Limitations

- **CRITICAL**: `npm run build` fails due to Google Fonts network restrictions in sandboxed environments
- The application uses Geist and Geist Mono fonts from fonts.googleapis.com which may be blocked
- **Workaround for development**: Use `npm run dev` exclusively for testing - it works perfectly
- **If you need to test build**: Temporarily modify app/layout.tsx to remove Google Fonts imports and use local fonts

## Application Structure

### Main Applications

1. **Homepage** (`/`) - Project showcase and navigation
2. **MTG Commander Scorekeeper** (`/commander`) - Full-screen 4-player life tracker
3. **Magic Tutor Helper** (`/tutor-helper`) - Decklist filtering and card analysis tool
4. **FloatWise** (`/floatwise`) - NOAA weather tracking application for outdoor activity planning

### Key Directories

- `app/` - Next.js app router pages and components
  - `app/commander/` - Commander scorekeeper application
    - `components/` - React components for game UI
    - `hooks/` - Custom React hooks (localStorage, responsive design)
    - `types.ts` - TypeScript interfaces and types
    - `utils.ts` - Utility functions
  - `app/tutor-helper/` - Card filtering application
    - `components/` - UI components for decklist management
    - `hooks/` - Hooks for caching and Scryfall API
    - `types/` - Type definitions
    - `utils/` - Helper functions
  - `app/floatwise/` - Weather tracking application
    - `components/` - Weather display and location management components
    - `hooks/` - Hooks for weather data, autocomplete, and localStorage
    - `types.ts` - Type definitions for weather and location data
    - `utils.ts` - API utilities and helper functions
- `public/` - Static assets (SVG icons)

### Configuration Files

- `package.json` - Dependencies and scripts
- `tsconfig.json` - TypeScript configuration
- `tailwind.config.ts` - Tailwind CSS configuration
- `next.config.ts` - Next.js configuration (includes Scryfall image domains)
- `eslint.config.mjs` - ESLint configuration
- `.husky/pre-commit` - Git pre-commit hooks

## Validation Scenarios

**ALWAYS manually validate changes through complete user scenarios after making modifications.**

### Commander Scorekeeper Validation

1. Navigate to http://localhost:3000/commander
2. Verify 4-player quadrant layout displays correctly
3. Test life tracking: Click +1/-1 buttons and verify life totals update
4. Test commander damage: Click commander damage buttons between players
5. Test history tracking: Verify recent actions appear with timestamps
6. Test poison counters: Click poison +/- buttons
7. Test settings: Click settings gear and verify player name editing
8. **Mobile testing**: Resize browser to mobile dimensions and verify responsive layout

### Tutor Helper Validation

1. Navigate to http://localhost:3000/tutor-helper
2. Verify "No Decklist Loaded" state displays
3. Test decklist import: Click "Import Decklist" and test with sample Magic decklist
4. Test filtering: Verify mana cost filters (0-7+) work correctly
5. Test card type filters: Click Land, Creature, Instant, etc. buttons
6. Test search: Type in search box and verify real-time filtering
7. **Note**: Scryfall API integration may fail in sandboxed environments due to network restrictions

### FloatWise Validation

1. Navigate to http://localhost:3000/floatwise
2. Verify initial empty state displays with "Add location to get started" message
3. Test location search: Click "Add Location" button and search for a city (e.g., "Seattle")
4. Verify autocomplete suggestions appear with real-time search
5. Test adding location: Select a city from suggestions and confirm it's added to the list
6. Verify weather data loads: Check that 10-day calendar and hourly weather table display
7. Test date selection: Click different dates in the calendar to view different forecasts
8. Test weather table: Verify temperature and wind data display correctly with color coding
9. Test location removal: Click remove button on a location and verify it's deleted
10. Test persistence: Refresh page and verify locations are restored from localStorage
11. **Note**: NOAA API and OpenStreetMap may fail in sandboxed environments due to network restrictions

### Homepage Validation

1. Navigate to http://localhost:3000
2. Verify project cards display correctly
3. Test navigation links to /commander, /tutor-helper, and /floatwise
4. Verify responsive grid layout on different screen sizes

## Common Development Tasks

### Making UI Changes

- Modify components in `app/commander/components/`, `app/tutor-helper/components/`, or `app/floatwise/components/`
- **Always test immediately** with `npm run dev` after changes
- Pay attention to Tailwind CSS classes for styling
- Check mobile responsiveness with browser dev tools

### Adding New Features

- Follow Next.js app router conventions
- Use TypeScript interfaces defined in `types.ts` files
- Implement custom hooks in `hooks/` directories for reusable logic
- **Always add proper TypeScript types** - run `npm run type-check` frequently

### State Management

- Commander app uses React useState with localStorage persistence
- Tutor helper uses custom hooks for caching and API interactions
- FloatWise uses custom hooks for weather data fetching, location storage, and autocomplete search
- **Important**: State persists across browser sessions via localStorage

### Styling Guidelines

- Uses Tailwind CSS utility classes throughout
- Dark theme with specific color palette (see COMMANDER_PAGE_DOCUMENTATION.md)
- Mobile-first responsive design approach
- Custom CSS in `app/globals.css` for base styles
- No rounded corners

## Troubleshooting

### Common Issues

- **Build failures**: Always due to Google Fonts - use development server instead
- **Type errors**: Run `npm run type-check` to identify issues
- **Linting errors**: Run `npm run lint` to identify and fix style issues
- **Hot reload not working**: Restart development server with `npm run dev`

### Network Dependencies

- **Scryfall API**: Used by tutor-helper for card data (may fail in restricted environments)
- **NOAA API**: Used by floatwise for weather forecast data (may fail in restricted environments)
- **OpenStreetMap Nominatim**: Used by floatwise for location search (may fail in restricted environments)
- **Google Fonts**: Blocks production builds (workaround: use local fonts temporarily)

### Performance Notes

- Development server uses Turbopack for fast rebuilds
- Large decklists in tutor-helper may cause performance issues
- LocalStorage usage for persistence - check browser storage limits

## Repository Navigation Quick Reference

### Frequently Modified Files

- `app/commander/page.tsx` - Main Commander scorekeeper page
- `app/tutor-helper/page.tsx` - Main tutor helper page
- `app/floatwise/page.tsx` - Main FloatWise weather tracking page
- `app/page.tsx` - Homepage
- `app/layout.tsx` - Root layout (contains font imports)
- `app/globals.css` - Global styles

### Key Type Definitions

- `app/commander/types.ts` - PlayerState, HistoryEntry, UndoOperation interfaces
- `app/tutor-helper/types/` - Card and decklist type definitions
- `app/floatwise/types.ts` - Weather, location, and forecast type definitions

### Hooks and Utilities

- `app/commander/hooks/useLocalStorage.ts` - Game state persistence
- `app/commander/hooks/useResponsive.ts` - Mobile/responsive detection
- `app/tutor-helper/hooks/useLocalStorageCache.ts` - Card data caching
- `app/floatwise/hooks/useWeatherData.ts` - Weather API management
- `app/floatwise/hooks/useLocationStorage.ts` - Location persistence
- `app/floatwise/hooks/useAutocomplete.ts` - Intelligent location search

### Documentation

- `COMMANDER_PAGE_DOCUMENTATION.md` - Comprehensive Commander app documentation
- `FLOATWISE_DOCUMENTATION.md` - Comprehensive FloatWise app documentation
- `README.md` - Basic Next.js setup information

## Build and Deployment Notes

- **Development**: Use `npm run dev` exclusively
- **Production**: Not buildable in sandboxed environments due to Google Fonts
- **Deployment**: Designed for Vercel platform (see next.config.ts)
- **Dependencies**: All managed through npm, no additional build tools required

---

_Last Updated: January 2025_
_Framework: Next.js 15.5.0 with React 19 and TypeScript_
_Primary Applications: MTG Commander Scorekeeper, Magic Tutor Helper, and FloatWise Weather Tracker_
