# bingo-announcements Specification

## Purpose
Celebrates bingos in front of the whole room: when a player first completes a line, every connected player sees who did it and in which place, once per player and never as an echo of a reconnect.

## Requirements

### Requirement: Announced to everyone
The system SHALL show a message on every connected page when a player's card becomes a bingo for the first time, naming the player and their placement.

#### Scenario: Second player gets a bingo
- **GIVEN** one player has already had a bingo
- **WHEN** another player completes their first line
- **THEN** every connected page shows a message naming that player with placement 2

#### Scenario: First player gets a bingo
- **WHEN** the first player in the room completes a line
- **THEN** every connected page shows a message naming that player with placement 1

### Requirement: Placement by order
The system SHALL number first bingos in the order the server receives them, starting at 1 for each server run.

#### Scenario: Order of arrival
- **WHEN** three players complete their first lines one after another
- **THEN** their messages carry placements 1, 2 and 3 in that order

### Requirement: Once per player
The system SHALL announce each player's first bingo only once, even if they unmark and mark cells again, reload the page, or reuse an older copy of their cookie.

#### Scenario: Unmark and complete again
- **GIVEN** a player whose first bingo was announced
- **WHEN** they unmark a cell and complete the line again
- **THEN** nothing is announced

#### Scenario: Older cookie copy
- **GIVEN** a player whose first bingo was announced during this server run
- **WHEN** they send a request with an older copy of their cookie from before the bingo and complete a line
- **THEN** nothing is announced a second time

### Requirement: Silent after a restart
The system SHALL NOT announce anything when players reconnect after a restart, including players who already had a bingo.

#### Scenario: Reconnect after redeploy
- **WHEN** pages reconnect after a restart
- **THEN** no bingo message is shown on any page

### Requirement: Own variant
The page SHALL show the winning player a message addressed to them instead of the generic one.

#### Scenario: Viewer is the winner
- **WHEN** the announced player is the viewer
- **THEN** their page shows a message addressed to them, with their placement

#### Scenario: Viewer is someone else
- **WHEN** the announced player is another player
- **THEN** the page shows the generic message naming that player

### Requirement: Short-lived and limited
The page SHALL remove each message by itself after about 6 seconds and SHALL show at most 3 messages at a time, dropping the oldest.

#### Scenario: Auto dismiss
- **WHEN** a message has been shown for about 6 seconds
- **THEN** it disappears without any interaction

#### Scenario: Burst of bingos
- **WHEN** a fourth message arrives while three are showing
- **THEN** the oldest message is removed

### Requirement: Plain text names
The message SHALL display the player's name as plain text.

#### Scenario: Markup in a name
- **WHEN** a player named `<b>x</b>` gets a bingo
- **THEN** the message shows that exact text and no markup is interpreted

### Requirement: Late joiners see no replay
The system SHALL NOT replay earlier announcements to pages that connect later.

#### Scenario: Page connects after a bingo
- **WHEN** a page connects after another player's bingo was announced
- **THEN** it shows no message, and the player appears in the standings with the "AGI ACHIEVED" mark
