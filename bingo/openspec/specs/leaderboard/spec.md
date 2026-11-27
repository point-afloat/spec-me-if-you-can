# leaderboard Specification

## Purpose

Shows every player how they stand against the room: live, ranked standings of all players by ticked words, derived only from verified card state and able to rebuild itself after the server restarts.

## Requirements

### Requirement: Ranked standings
The system SHALL rank players by the number of marked word cells on their card, highest first, not counting the pizza center, and SHALL break ties in favour of the player who reached that number first.

#### Scenario: Higher score ranks first
- **GIVEN** player A with 5 marked words and player B with 3
- **WHEN** the standings are shown
- **THEN** player A is ranked above player B

#### Scenario: Tie goes to the earlier player
- **GIVEN** players A and B who both reached 4 marked words, A first
- **WHEN** the standings are shown
- **THEN** player A is ranked above player B

#### Scenario: Pizza does not count
- **WHEN** a player has only the pizza center marked
- **THEN** their score is 0

### Requirement: Score comes from the verified card
The system SHALL derive every score from the player's signed card cookie and SHALL NOT accept a score, name or bingo claim from the client.

#### Scenario: Forged cookie
- **WHEN** a request carries a cookie whose signature does not verify
- **THEN** the request does not create or change any standings entry

#### Scenario: No client-supplied score
- **WHEN** a client sends a request that includes a score value
- **THEN** the score value is ignored and the standings reflect only the verified cookie

### Requirement: Live updates
The system SHALL push the current standings to every connected page within 1 second of any change, without the page reloading.

#### Scenario: Another player ticks a word
- **GIVEN** two connected pages for different players
- **WHEN** the first player ticks a word
- **THEN** the second page shows the updated standings within 1 second

#### Scenario: Nickname change
- **WHEN** a player sets or changes their nickname
- **THEN** every connected page shows the new name in the standings within 1 second

### Requirement: Immediate snapshot
The system SHALL send the current standings as soon as a page connects.

#### Scenario: Late joiner
- **WHEN** a page connects while other players already have scores
- **THEN** it receives the full current standings immediately, without waiting for the next change

### Requirement: Names
The system SHALL show each player under their nickname, or under their anonymous label while they have none, and SHALL display every name as plain text.

#### Scenario: Anonymous player
- **WHEN** a player has no nickname
- **THEN** the standings show their label such as "Player 4F2A"

#### Scenario: Markup in a name
- **WHEN** a player's nickname is `<b>x</b>`
- **THEN** the standings show that exact text and no markup is interpreted

### Requirement: Own position
The page SHALL highlight the viewer's own entry and SHALL show their rank, score and the total number of players, even when they are outside the entries shown.

#### Scenario: Viewer in the shown entries
- **WHEN** the viewer is ranked within the shown entries
- **THEN** their row is highlighted

#### Scenario: Viewer outside the shown entries
- **GIVEN** more players than shown entries and the viewer ranked below them
- **WHEN** the standings are shown
- **THEN** the viewer's own row, with their rank, is shown below the listed entries

### Requirement: AGI ACHIEVED mark
The system SHALL flag every player who has had a bingo in the standings, and the page SHALL show those players with the fixed caption "AGI ACHIEVED" under their name and their name in a highlighted style. The mark stays after they unmark cells.

#### Scenario: Player with a bingo
- **WHEN** a player's card has become a bingo at least once
- **THEN** their standings entry is flagged, and the page shows "AGI ACHIEVED" under their name with the name highlighted

#### Scenario: Stays after unmarking
- **GIVEN** a player with the mark
- **WHEN** they unmark cells so that their card is no longer a bingo
- **THEN** the mark is still shown

#### Scenario: Players without a bingo
- **WHEN** a player has never had a bingo
- **THEN** their name is shown plainly with no caption

#### Scenario: Name stays plain text
- **WHEN** a player with the mark has the nickname `<b>x</b>`
- **THEN** the page shows that exact text as the highlighted name and interprets no markup

#### Scenario: Reduced motion
- **WHEN** a visitor with reduced motion enabled views a marked name
- **THEN** the highlight is shown without any animation

### Requirement: Rebuilds after a restart
The system SHALL register a player from their verified cookie whenever their page connects or requests the standings, and SHALL therefore rebuild the standings after a restart as players reconnect, without announcing anything.

#### Scenario: Redeploy
- **GIVEN** players with marked cells and an empty standings list after a restart
- **WHEN** their pages reconnect
- **THEN** each player reappears with the score and nickname from their cookie

#### Scenario: Silent registration
- **WHEN** a player with an earlier bingo reconnects after a restart
- **THEN** they appear with the bingo badge and no announcement is sent

#### Scenario: Viewer without a card
- **WHEN** a visitor without a valid cookie views the standings
- **THEN** they see the standings but are not listed in them

### Requirement: Bounded list
The page SHALL show at most the top 10 players, and the server SHALL keep at most 5000 players, dropping the least recently seen first.

#### Scenario: Many players
- **WHEN** more than 10 players are registered
- **THEN** only the top 10 and the viewer's own row are shown, with the total count

#### Scenario: Memory limit
- **WHEN** a 5001st player registers
- **THEN** the least recently seen player is dropped

### Requirement: Polling fallback
The system SHALL offer the standings as a plain request and the page SHALL fall back to requesting them every 3 seconds while the live stream is unavailable, returning to the stream when it works again.

#### Scenario: Stream blocked
- **WHEN** the live stream cannot be kept open
- **THEN** the page keeps showing standings that are at most 3 seconds old

#### Scenario: Stream restored
- **WHEN** the live stream connects again
- **THEN** the page stops polling and shows live updates
