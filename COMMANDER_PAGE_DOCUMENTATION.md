# Commander Page Documentation

## Overview
The Commander page (`/commander`) is a full-screen, touch-friendly scorekeeper application designed for the Commander format of Magic: The Gathering. It supports 4 players with a responsive quadrant layout optimized for tablets and mobile devices.

## Table of Contents
- [Core Features](#core-features)
- [UI Layout](#ui-layout)
- [Player Management](#player-management)
- [Game Mechanics](#game-mechanics)
- [History System](#history-system)
- [Settings & Persistence](#settings--persistence)
- [Mobile Responsiveness](#mobile-responsiveness)
- [Technical Implementation](#technical-implementation)
- [State Management](#state-management)
- [LocalStorage Integration](#localstorage-integration)

## Core Features

### 4-Player Quadrant Layout
- **Grid System**: 2x2 grid layout dividing the screen into 4 equal quadrants
- **Player Positioning**: Each player occupies exactly 1/4 of the screen space
- **Responsive Design**: Quadrants automatically adjust to screen size and orientation

### Life Tracking
- **Starting Life**: All players begin with 40 life (Commander format standard)
- **Life Controls**: 
  - Main buttons: -5, -1, +1, +5 life adjustments
  - Large, touch-friendly buttons for easy tablet use
  - Immediate visual feedback with color-coded actions

### Commander Damage Tracking
- **Per-Opponent Tracking**: Each player tracks commander damage from the other 3 players
- **Compact Display**: Shows "PlayerName: #" format for space efficiency
- **Abbreviation System**: Smart abbreviation for opponent names (first 3 characters, numbered for duplicates)
- **Individual Controls**: +/- buttons for each opponent's commander damage

### Poison Counter System
- **Dedicated Tracker**: Separate poison counter with custom SVG icon
- **Color Coding**: Distinct dark green styling for poison-related actions
- **Standard Controls**: +/- buttons for poison management

### Global Damage System
- **"Damage All Others" Button**: Applies -1 life to all other players simultaneously
- **Efficient Group Effects**: Handles cards that affect multiple players
- **History Tracking**: Records source player for group damage effects

## UI Layout

### Quadrant Structure
Each player quadrant contains (top to bottom):
1. **Player Name Label** - Customizable player identification
2. **Life Counter Display** - Large, prominent life total
3. **Life Control Buttons** - Main +/- life adjustment buttons
4. **Damage All Others Button** - Global damage control
5. **Recent Actions History** - Scrollable action log
6. **Commander Damage Counters** - 3 opponent damage trackers
7. **Poison Counter** - Poison tracking with icon

### Control Elements
- **Corner Controls**: Skull (eliminate) and rotate buttons in top-right
- **Settings Button**: Gear icon in top-left corner
- **Menu Modal**: Centralized settings and game controls

## Player Management

### Player Names
- **Default Names**: "Player 1", "Player 2", "Player 3", "Player 4"
- **Customization**: Editable through settings modal
- **Persistence**: Optional localStorage saving with checkbox control
- **Reset Function**: One-click reset to default names

### Player States
- **Active State**: Normal gameplay state
- **Dead/Eliminated**: Visual overlay with 50% opacity, skull button toggles state
- **Rotation**: Individual quadrant rotation (0°, 90°, 180°, 270°)

### Player Rotation System
- **Desktop**: Full 4-way rotation (0° → 90° → 180° → 270° → 0°)
- **Mobile Portrait**: Flip between 0° ↔ 180°
- **Mobile Landscape**: Flip between 90° ↔ 270°
- **Auto-Detection**: Responsive rotation based on screen dimensions
- **Debouncing**: Prevents rapid clicking glitches with 300ms delay

## Game Mechanics

### Life Management
```typescript
interface PlayerState {
  life: number; // Starting at 40
  commanderDamage: [number, number, number]; // Damage from other 3 players
  poison: number; // Poison counters
  rotation: 0 | 90 | 180 | 270; // Quadrant rotation
  name: string; // Player name
  history: HistoryEntry[]; // Action history
  isDead: boolean; // Elimination status
}
```

### Action Types
- **Life Changes**: Direct life modifications (+/- buttons)
- **Commander Damage**: Damage from specific opponents
- **Poison**: Poison counter modifications
- **Global Effects**: Damage applied to multiple players

### Game Reset
- **Complete Reset**: Returns all values to starting state
- **Name Preservation**: Player names maintained through reset
- **Confirmation Dialog**: "Are you sure?" prompt prevents accidental resets
- **History Clearing**: All action histories reset

## History System

### Action Logging
- **Real-time Tracking**: Every action immediately logged with timestamp
- **Color Coding**: 
  - Green: Positive changes (+life, +poison, +commander damage)
  - Red: Negative changes (-life, -poison, -commander damage)
  - Blue: Commander damage actions
  - Green: Poison-related actions
- **Unlimited History**: No limit on stored actions

### History Display Format
```
[+/-] [Number] [Action Type] [Time]
```
- **4-Column Grid Layout**: Sign, Number, Label, Time
- **Examples**:
  - `+ 5 life 2:34`
  - `- 2 from Alice 2:35`
  - `+ 1 poison 2:36`

### History Features
- **Scrollable**: Vertical scroll for long history lists
- **Auto-scroll**: Newest entries appear at top
- **Responsive**: Adjusts to available quadrant space
- **Consistent Formatting**: Standardized across all action types

## Settings & Persistence

### Settings Modal
- **Player Name Management**: Edit all 4 player names
- **Persistence Control**: Checkbox to enable/disable name saving
- **Game Reset**: Reset button with confirmation
- **Mobile Responsive**: Optimized layouts for mobile/tablet

### LocalStorage Integration
- **Settings Key**: `commander-settings`
- **Stored Data**:
  ```json
  {
    "saveNames": boolean,
    "playerNames": [string, string, string, string]
  }
  ```
- **Auto-Save**: Names saved immediately when persistence enabled
- **Load on Mount**: Saved names restored on page load
- **Clean Disable**: Data cleared when persistence disabled

### Reset Functionality
- **Name Reset Button**: Instant reset to "Player 1", "Player 2", etc.
- **Game Reset**: Complete game state reset with confirmation
- **Persistence Respect**: Saved names maintained through game reset

## Mobile Responsiveness

### Breakpoint Detection
- **Mobile Portrait**: `width < 768px && height > width`
- **Mobile Landscape**: `height < 500px && width > height`
- **Desktop**: All other dimensions

### Responsive Features
- **Dynamic Rotation**: Automatic initial rotation for mobile landscape
- **Orientation Handling**: Event listeners for device rotation
- **Touch Optimization**: Large button targets for finger interaction
- **Responsive Typography**: Font sizes adapt to screen size

### Mobile-Specific Behaviors
- **Limited Rotation**: Flip-only rotation instead of full 4-way
- **Settings Modal**: Optimized padding, layout, and text sizes
- **Grid Layouts**: Player name inputs use 2-column grid in landscape

## Technical Implementation

### Component Architecture
- **Main Component**: `CommanderPage` - Root component with all state
- **Sub-Component**: `PlayerQuadrant` - Individual player interface
- **Pure Functional**: No class components, hooks-based state management

### Key Technologies
- **Framework**: Next.js with React
- **Styling**: Tailwind CSS with custom color palette
- **State**: React hooks (useState, useEffect)
- **Storage**: Browser localStorage API
- **Icons**: Inline SVG components

### Performance Optimizations
- **Debounced Rotation**: Prevents rapid clicking issues
- **Efficient Re-renders**: Minimal state updates
- **Event Cleanup**: Proper listener removal
- **Responsive Breakpoints**: Cached window dimension checks

## State Management

### Central State
All game state managed in the main `CommanderPage` component:
- `players`: Array of 4 PlayerState objects
- `isMenuOpen`: Settings modal visibility
- `showResetConfirm`: Reset confirmation dialog state
- `rotatingPlayer`: Debouncing state for rotation
- `saveNames`: Persistence preference

### State Updates
- **Immutable Updates**: All state changes use immutable patterns
- **Batch Updates**: Related changes grouped together
- **History Integration**: Every game action updates both state and history

### Event Handling
- **Centralized Handlers**: All game logic in main component
- **Prop Drilling**: State and handlers passed to quadrants
- **Event Delegation**: Efficient event management

## LocalStorage Integration

### Data Structure
```typescript
interface SavedSettings {
  saveNames: boolean;
  playerNames: string[];
}
```

### Save Triggers
- **Checkbox Toggle**: Enable/disable persistence
- **Name Changes**: Auto-save when names modified
- **Manual Save**: Reset button triggers save if enabled

### Load Process
1. **Component Mount**: Check for saved settings
2. **Parse Data**: JSON parse with error handling
3. **Apply Settings**: Update state with saved values
4. **Graceful Fallback**: Use defaults if data invalid

### Data Management
- **Clean Disable**: Remove localStorage data when disabled
- **Error Handling**: Graceful handling of storage failures
- **Browser Support**: Works across all modern browsers

## Color Palette

### Theme Colors
- **Background**: `#1a1a1a` (dark gray)
- **Quadrant Background**: `#222222` (medium gray)
- **Button Background**: `#2a2a2a` (lighter gray)
- **Button Hover**: `#3a3a3a` (hover state)
- **Text Primary**: `#cccccc` (light gray)
- **Text Secondary**: `#888888` (medium gray)
- **Borders**: `#333333` (subtle gray)

### Action Colors
- **Positive Actions**: `#22c55e` (green)
- **Negative Actions**: `#dc2626` (red)
- **Commander Damage**: `#3b82f6` (blue)
- **Poison**: `#16a34a` (dark green)
- **Dead State**: `#7a1a1a` (dark red)

## Future Development Considerations

### Potential Enhancements
- **Multiple Game Formats**: Support for other MTG formats
- **Advanced Statistics**: Win/loss tracking, average game length
- **Sound Effects**: Audio feedback for actions
- **Themes**: Multiple color schemes
- **Export Data**: Game history export functionality
- **Multiplayer Sync**: Real-time sync across devices

### Technical Debt
- **Component Splitting**: Consider splitting large PlayerQuadrant component
- **Custom Hooks**: Extract common logic into reusable hooks
- **TypeScript Strict Mode**: Enhance type safety
- **Testing**: Add unit and integration tests
- **Performance**: Consider React.memo for optimization

### Accessibility Improvements
- **Screen Reader Support**: Enhanced ARIA labels
- **Keyboard Navigation**: Full keyboard accessibility
- **High Contrast Mode**: Support for accessibility preferences
- **Focus Management**: Improved focus handling in modals

---

*Last Updated: December 2024*
*Version: 1.0*
*Framework: Next.js 14+ with React 18+*
