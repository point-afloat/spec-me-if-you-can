# game-interface Specification

## Purpose

Defines how the game page presents itself and responds to input: a compact terminal-style interface where the card is immediately visible, progress is shown, and interaction is instant and self-contained.

## Requirements

### Requirement: Card visible without scrolling
The system SHALL present the page so that the whole 5x5 card is visible without scrolling on a viewport of 390 by 700 pixels, with or without the bingo message showing.

#### Scenario: Phone-sized viewport
- **WHEN** the page is shown on a 390 by 700 pixel viewport
- **THEN** all 25 cells of the card are fully visible without scrolling

#### Scenario: Bingo message showing
- **WHEN** the card is a bingo and the bingo message is visible on the same viewport
- **THEN** all 25 cells are still fully visible without scrolling

### Requirement: Progress indicator
The system SHALL show the player's progress as the number of marked word cells out of 24 and as a rounded percentage, not counting the pizza center, and SHALL expose it as a progress bar with the same value.

#### Scenario: Ten words marked
- **WHEN** 10 word cells are marked
- **THEN** the page shows 42% and 10/24, and the progress bar value is 42

#### Scenario: Fresh card
- **WHEN** only the pizza center is marked
- **THEN** the page shows 0% and 0/24

### Requirement: Instant in-place tile updates
The system SHALL update a tile's state immediately when it is ticked or unticked, without any animation, and SHALL keep keyboard focus on the tile that was activated.

#### Scenario: Tick a tile
- **WHEN** the player ticks a tile
- **THEN** the tile changes to its marked appearance at once with no transition animation and the other tiles do not change or re-animate

#### Scenario: Focus stays
- **WHEN** a player ticks a tile using the keyboard
- **THEN** that tile still has keyboard focus afterwards

### Requirement: Reduced motion
The system SHALL disable all decorative animation, including the starfield movement, glows, shimmer and the card fade-in, for visitors whose system asks for reduced motion.

#### Scenario: Reduced motion on
- **WHEN** a visitor with reduced motion enabled opens the page
- **THEN** no decorative animation runs and the card is fully usable

### Requirement: Self-contained page
The page SHALL load all scripts, styles and fonts from its own origin and SHALL NOT load external resources.

#### Scenario: No external requests
- **WHEN** the page is loaded
- **THEN** every request goes to the page's own origin

### Requirement: Leaderboard below the card
The page SHALL show the leaderboard in a pane below the card, so that the card stays fully visible without scrolling on a viewport of 390 by 700 pixels and the leaderboard is reached by scrolling.

#### Scenario: Card first
- **WHEN** the page is shown on a 390 by 700 pixel viewport
- **THEN** all 25 cells are fully visible without scrolling and the leaderboard pane starts below them

#### Scenario: Leaderboard reachable
- **WHEN** the viewer scrolls down
- **THEN** the standings, their own row and the total number of players are visible

### Requirement: Non-blocking announcement messages
The page SHALL show bingo announcements as a status message that takes no keyboard focus, is announced to assistive technology politely, and does not cover any card cell on a viewport of 390 by 700 pixels.

#### Scenario: Message appears
- **WHEN** a bingo announcement arrives on a 390 by 700 pixel viewport
- **THEN** it is shown without moving keyboard focus and without covering any card cell

#### Scenario: Reduced motion
- **WHEN** a visitor with reduced motion enabled receives an announcement
- **THEN** the message appears and disappears without animation

### Requirement: Unicorn does not get in the way
The unicorn animation SHALL NOT take keyboard focus, SHALL NOT intercept clicks or taps, and SHALL NOT cover any card cell on a viewport of 390 by 700 pixels.

#### Scenario: Tapping while the unicorn dances
- **WHEN** the unicorn is dancing and the viewer taps a card cell
- **THEN** the cell is ticked as usual

#### Scenario: Card stays visible
- **WHEN** the unicorn is dancing on a 390 by 700 pixel viewport
- **THEN** all 25 cells remain fully visible
