# card-generation Specification

## Purpose

Defines how a player's bingo card is created: a random 5x5 grid of AI buzzwords with a free pizza center, drawn from a word list whose positions stay stable over time.

## Requirements

### Requirement: Card layout
The system SHALL generate a 5x5 card with 24 buzzwords and one free center cell showing a pizza.

#### Scenario: New card shape
- **WHEN** a visitor without a valid card cookie opens the page
- **THEN** a card with 25 cells is shown, the center cell shows a pizza and the other 24 cells each show one buzzword

#### Scenario: Pizza is pre-marked
- **WHEN** a new card is created
- **THEN** the pizza center cell is marked and cannot be unmarked

### Requirement: Random distinct words
The system SHALL fill the 24 word cells with distinct words chosen at random from the buzzword list.

#### Scenario: No duplicates
- **WHEN** any card is generated
- **THEN** no word appears twice on that card

#### Scenario: Cards differ between players
- **WHEN** two visitors open the page for the first time
- **THEN** their cards are generated independently and are very likely to differ in word selection or placement

### Requirement: Append-only word list
The system SHALL identify each buzzword by its fixed position in the buzzword list, and a change to the list SHALL only append new words, never reorder, replace or remove existing ones.

#### Scenario: Old card after list grows
- **GIVEN** a card created when the list had N words
- **WHEN** the list is extended with new words and the page is opened again
- **THEN** the card shows exactly the same words in the same cells as before

#### Scenario: New words are eligible later
- **WHEN** a card is generated after words were appended
- **THEN** the appended words can appear on the new card

### Requirement: List large enough for variety
The buzzword list SHALL contain at least 40 words at release, so that cards differ noticeably between players.

#### Scenario: Minimum list size
- **WHEN** the application starts
- **THEN** the buzzword list has at least 40 distinct entries
