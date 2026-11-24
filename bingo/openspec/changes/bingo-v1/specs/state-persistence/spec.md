# Spec Delta

## Purpose

Defines the player cookie that stores the card, marks, player identity and bingo announcement flag, so state survives reloads and redeployments and stays forward compatible.

## ADDED Requirements

### Requirement: Cookie content
The system SHALL store the player's state in a single cookie containing a format version, the 24 word positions of the card, the marked cells, a random anonymous player id, an optional nickname and a flag saying whether the player's first bingo was announced.

#### Scenario: Cookie set on first visit
- **WHEN** a visitor opens the page without a valid cookie
- **THEN** the response sets a cookie containing all of the listed fields, with no cells marked except the center, an empty nickname and the announcement flag unset

#### Scenario: State restored on return
- **WHEN** a player returns with a valid cookie
- **THEN** the page shows the same card with the same marked cells

### Requirement: Integrity protection
The system SHALL sign the cookie with a secret held by the server and SHALL accept only cookies whose signature verifies.

#### Scenario: Forged marks
- **WHEN** a client edits the cookie to mark more cells and sends it back
- **THEN** the signature check fails and the cookie is rejected

#### Scenario: Rejected cookie gets a new card
- **WHEN** a request arrives with an invalid cookie
- **THEN** the page issues a fresh card and cookie instead of showing an error

### Requirement: Survives redeployment
The system SHALL keep players' cards and marks valid across redeployments of the application, provided the signing secret and domain are unchanged.

#### Scenario: Redeploy with same secret
- **GIVEN** a player with marked cells
- **WHEN** the application is redeployed with the same secret and domain and the player reloads the page
- **THEN** the same card and marks are shown

#### Scenario: Lifetime
- **WHEN** the cookie is set
- **THEN** it remains valid for at least 7 days and is sent only over HTTPS

### Requirement: Versioned and forward compatible
The cookie SHALL carry a format version, and a newer application version SHALL continue to accept cookies of every earlier version.

#### Scenario: Older version accepted
- **GIVEN** a valid cookie with format version 1
- **WHEN** a later application version reads it
- **THEN** the card and marks are restored unchanged

#### Scenario: Unknown newer version
- **WHEN** the application receives a cookie with a version it does not know
- **THEN** it treats the cookie as invalid and issues a new card

### Requirement: Anonymous player id
The system SHALL assign each cookie a random player id that contains no personal data and stays the same for the life of the cookie.

#### Scenario: Id is stable
- **WHEN** a player marks several cells
- **THEN** the player id in the cookie does not change

#### Scenario: Ids differ
- **WHEN** two different visitors receive cookies
- **THEN** their player ids are different
