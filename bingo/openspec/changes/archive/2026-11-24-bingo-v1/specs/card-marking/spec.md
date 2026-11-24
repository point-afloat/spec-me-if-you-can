# Spec Delta

## Purpose

Defines how players tick and untick buzzwords on their card and how the system recognises and reports a bingo, with the server as the authority over the card state.

## ADDED Requirements

### Requirement: Toggle a cell
The system SHALL let a player toggle any word cell between marked and unmarked, and the server SHALL apply the change and return the updated card state.

#### Scenario: Mark a word
- **WHEN** the player clicks an unmarked word cell
- **THEN** the cell becomes marked and stays marked after a page reload

#### Scenario: Unmark a word
- **WHEN** the player clicks a marked word cell
- **THEN** the cell becomes unmarked

#### Scenario: Center cell is fixed
- **WHEN** the player clicks the pizza center cell
- **THEN** the cell stays marked and nothing else changes

### Requirement: Reject invalid marks
The system SHALL reject a mark request that has no valid card cookie or refers to a cell outside the 25 cells, and SHALL leave the card unchanged.

#### Scenario: Cell out of range
- **WHEN** a mark request names a cell number below 0 or above 24
- **THEN** the server responds with an error and the cookie is not modified

#### Scenario: Missing or tampered cookie
- **WHEN** a mark request arrives without a cookie or with a cookie whose signature is invalid
- **THEN** the server does not apply the mark and the visitor is treated as a new player on the next page load

### Requirement: Bingo detection
The system SHALL consider a card a bingo when all five cells of any row, any column or either diagonal are marked, counting the pizza center as marked.

#### Scenario: Row bingo
- **WHEN** all five cells of one row are marked
- **THEN** the card is a bingo

#### Scenario: Diagonal needs only four words
- **WHEN** the four non-center cells of a diagonal are marked
- **THEN** the card is a bingo, because the pizza center is marked

#### Scenario: No bingo yet
- **WHEN** no complete row, column or diagonal is marked
- **THEN** the card is not a bingo

### Requirement: Bingo message
The system SHALL show the player a message when their card becomes a bingo through a mark.

#### Scenario: First bingo
- **WHEN** a mark completes the first line on the card
- **THEN** the page shows a "bingo" message to that player

#### Scenario: Unmarking afterwards
- **WHEN** a player unmarks a cell after having a bingo
- **THEN** the card is no longer a bingo and the message is dismissed, but the player's earlier bingo remains recorded as announced
