# Proposal

## Why

v1 is a solo game: every player ticks buzzwords on their own card with no sense of the room. For the live demo of the talk the bingo gets a competitive layer, a live leaderboard and a room-wide bingo announcement, added as a spec-driven change on top of the running v1. It is also prepared in advance on a fallback branch, so the demo can switch to a finished v2 if the live build goes wrong.

## What Changes

- New live leaderboard: players are ranked by the number of ticked words (the pizza does not count), ties broken by who reached the score first. It shows nicknames, or the anonymous label, a badge for players who have had a bingo, the viewer's own highlighted row and rank, and the total number of players.
- Standings update live on every connected page through a server-sent-events stream, with a plain polling endpoint as fallback.
- Ticking a word and changing a nickname update the standings on the server. The score always comes from the verified, signed cookie, never from the client.
- Every player's first bingo is announced on all connected devices with a short-lived message and a placement ("#3"), once per player. The winner sees a message addressed to them.
- After a redeploy the in-memory standings are empty and rebuild silently as players' pages reconnect with their existing cookie; reconnecting never triggers an announcement.
- The page gets a leaderboard pane below the card (the card stays fully visible without scrolling) and a bingo toast.
- No change to the cookie format: it already carries the player id, nickname and the "first bingo announced" flag.

## Capabilities

### New Capabilities
- `leaderboard`: ranked, live standings of all players with own-row highlight, bingo badge, silent re-registration after a restart, a bounded player list, and a polling fallback.
- `bingo-announcements`: the room-wide, once-per-player message when a player first gets a bingo, with placement order, an own-player variant, and silence on reconnects.

### Modified Capabilities
- `game-interface`: adds the leaderboard pane below the card and the accessible, non-blocking bingo message (new requirements; the existing ones stay as they are).

## Impact

- Server: a new in-memory standings store and ranking logic, `GET /api/events` (event stream), `GET /api/standings` (polling fallback), and hooks in `POST /api/mark` and `POST /api/nickname`.
- Page: a leaderboard pane, an EventSource client with polling fallback, and a bingo toast; every standings message carries the viewer's own entry so the page can highlight it.
- Tests for ranking, registration, announcements and the stream; README section for the new endpoints.
- No new dependencies, no cookie change, no persistent storage; Sliplane keeps running one container.
- Out of scope: persisting standings across restarts, nickname moderation, rooms or multiple boards, an admin reset, WebSockets.
