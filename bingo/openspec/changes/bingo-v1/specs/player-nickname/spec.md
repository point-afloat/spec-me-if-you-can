# Spec Delta

## Purpose

Lets players give themselves an optional display name, with an anonymous fallback, so they can be recognised later without accounts or personal data.

## ADDED Requirements

### Requirement: Optional nickname
The system SHALL let a player play without a nickname, and SHALL show the card immediately without asking for one.

#### Scenario: Card without a name
- **WHEN** a new visitor opens the page
- **THEN** the card is shown at once and a nickname field is available but empty

### Requirement: Anonymous fallback label
The system SHALL display a player without a nickname as "Player" followed by four characters derived from the player id, and the label SHALL stay the same for the life of the cookie.

#### Scenario: Fallback shown
- **WHEN** a player has not set a nickname
- **THEN** the page shows a label such as "Player 4F2A" for that player

#### Scenario: Fallback replaced
- **WHEN** the player sets a nickname
- **THEN** the nickname is shown instead of the fallback label

### Requirement: Nickname validation
The system SHALL accept a nickname only after trimming surrounding whitespace, if it has 1 to 20 characters and no control characters, and SHALL reject anything else without changing the stored nickname.

#### Scenario: Valid nickname
- **WHEN** the player submits "  Ada  "
- **THEN** the nickname "Ada" is stored

#### Scenario: Too long
- **WHEN** the player submits a name longer than 20 characters
- **THEN** the server responds with an error and the previous nickname is kept

#### Scenario: Empty or control characters
- **WHEN** the player submits an empty name or a name containing control characters
- **THEN** the server responds with an error and the previous nickname is kept

#### Scenario: Duplicates allowed
- **WHEN** two players submit the same nickname
- **THEN** both are accepted

### Requirement: Changeable nickname
The system SHALL let the player change their nickname at any time, and the card and marks SHALL stay unchanged by a name change.

#### Scenario: Rename after marking
- **GIVEN** a player with marked cells
- **WHEN** the player sets a different nickname
- **THEN** the new name is stored and the marked cells are unchanged

### Requirement: Nickname persists
The system SHALL keep the nickname in the player's cookie so that it survives reloads and redeployments.

#### Scenario: Reload
- **WHEN** a player with a nickname reloads the page
- **THEN** the same nickname is shown

### Requirement: Safe display
The system SHALL display every nickname as plain text and SHALL NOT interpret it as markup.

#### Scenario: Markup in a name
- **WHEN** a player sets the nickname `<script>x</script>`
- **THEN** the page shows that exact text as the name and no script runs
