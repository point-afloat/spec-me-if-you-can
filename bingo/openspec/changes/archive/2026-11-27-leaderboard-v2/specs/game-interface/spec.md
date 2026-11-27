# Spec Delta

## ADDED Requirements

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
