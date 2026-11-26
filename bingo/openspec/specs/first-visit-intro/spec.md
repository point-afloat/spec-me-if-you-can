# first-visit-intro Specification

## Purpose

Defines the terminal-style boot sequence a player sees on their first visit, so the game opens with a memorable intro that never gets in the way afterwards.

## Requirements

### Requirement: Plays on first visit
The system SHALL show a full-screen boot sequence when the page is opened in a browser that has not completed or skipped it before, and SHALL keep the rest of the page hidden until the sequence ends.

#### Scenario: Fresh browser
- **WHEN** a visitor opens the page in a browser with no record of a previous intro
- **THEN** the boot sequence is shown full screen and the card, status and name field are not visible until it ends

### Requirement: Ends by itself
The boot sequence SHALL end on its own within 5 seconds and then reveal the page.

#### Scenario: No interaction
- **WHEN** the visitor does nothing during the intro
- **THEN** the intro fades out within 5 seconds and the page is shown

### Requirement: Skippable
The system SHALL end the boot sequence immediately when the visitor presses any key or clicks or taps anywhere.

#### Scenario: Skip with a key
- **WHEN** the visitor presses any key during the intro
- **THEN** the intro ends immediately and the page is shown

#### Scenario: Skip with a tap
- **WHEN** the visitor taps the screen during the intro
- **THEN** the intro ends immediately and the page is shown

### Requirement: Shown once per browser
The system SHALL remember in the browser that the intro was completed or skipped and SHALL NOT show it again on later visits from that browser.

#### Scenario: Second visit
- **GIVEN** a browser that has already completed or skipped the intro
- **WHEN** the visitor opens the page again
- **THEN** the page is shown immediately without the intro

#### Scenario: Game cookie is independent
- **WHEN** the player's game cookie is deleted but the browser's intro record remains
- **THEN** the player gets a new card and the intro is not shown again

### Requirement: Replay on request
The system SHALL show the intro again when the page is opened with a `boot` query parameter, regardless of earlier visits.

#### Scenario: Forced replay
- **GIVEN** a browser that has already seen the intro
- **WHEN** the visitor opens the page with `?boot`
- **THEN** the intro is shown

### Requirement: Respects reduced motion
The system SHALL NOT show the intro to visitors whose system asks for reduced motion.

#### Scenario: Reduced motion
- **WHEN** a visitor with reduced motion enabled opens the page for the first time
- **THEN** the page is shown immediately and no intro plays

### Requirement: Works without storage
The page SHALL work normally when the browser blocks or loses its storage; in that case the intro SHALL be shown again on the next visit.

#### Scenario: Storage blocked
- **WHEN** the browser does not allow the page to store the intro record
- **THEN** the intro still ends normally, the page works, and the intro is shown again next visit

### Requirement: Fixed text only
The intro SHALL consist of fixed text and SHALL NOT display any value supplied by a player.

#### Scenario: Player data absent
- **WHEN** the intro is shown to a player who has set a nickname
- **THEN** the nickname does not appear anywhere in the intro
