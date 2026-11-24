# Design

## Context

v1 is deployed on Sliplane as one stateless container; all player state lives in a signed cookie that the server sets and verifies (`/api/mark`, `/api/nickname`). `/api/mark` already computes `newBingo` from the cookie's "announced" flag, and `/api/ping-stream` has shown that Sliplane's proxy passes a long-lived event stream with 5 s events and 15 s heartbeats. See proposal.md for the motivation and the specs for the requirements. This change is also built ahead of the talk on the branch `fallback/v2-leaderboard`, so the live demo can fall back to a finished v2.

## Goals / Non-Goals

**Goals:**
- A tiny in-memory standings store that can be rebuilt entirely from players' cookies after any restart.
- Live standings and bingo announcements over server-sent events, with a polling fallback.
- No cookie format change and no new dependencies.

**Non-Goals:**
- Persistence across restarts (no database, no volume).
- Nickname moderation, rooms, admin reset, WebSockets.
- Defending against a determined cheater beyond "scores come only from the signed cookie".

## Decisions

**1. In-memory store, rebuilt from cookies.** A `Leaderboard` class holds one entry per player: public id, display name, score, `announced` (bingo badge), `place`, `reachedAt` and last-seen time. A player is registered or refreshed whenever a request with a valid cookie reaches `/api/events`, `/api/standings`, `/api/mark` or `/api/nickname`. After a restart the store is empty and refills as pages reconnect. Alternative: persist to a file or SQLite - rejected, it adds a volume and a failure mode, and the cookie already is the durable state.

**2. Public player id derived with HMAC.** The id shown to other clients is the first 12 hex characters of `HMAC(secret, "pid:" + playerId)`. It lets pages highlight their own row without exposing the raw id stored in the cookie. Alternative: send the raw 6-byte id - works, but leaks cookie contents for no gain.

**3. Ranking.** Sort by score descending, then by `reachedAt` ascending, then by id for stability. The score is the number of marked word cells. `reachedAt` is a logical counter (not wall-clock time) taken whenever a player's score changes, so the entry whose score last changed earlier ranks higher and ties are deterministic. After a restart `reachedAt` is the registration time, so ties among re-registered players are effectively ordered by reconnect time; accepted.

**4. Bingo announcements are guarded twice.** `/api/mark` computes `newBingo` from the cookie flag as before, but the store also keeps `announced` per player and only announces when both say "first time". The cookie flag alone would let a player replay an older cookie copy (from before their bingo) to trigger repeat announcements; the store flag closes that within a server run. After a restart one extra announcement per player is possible and accepted (low stakes). The store flag is monotonic: it is set from the cookie on registration and never cleared. `place` is a counter incremented on each announced first bingo; players registered with `announced=true` get the badge but no place and no announcement.

**5. Event stream.** `GET /api/events` registers the viewer silently, sends an `event: standings` snapshot at once and then: standings changes (coalesced: at most one push per 150 ms), `event: bingo` immediately, a full snapshot every 10 s as application-level keep-alive, and a `: ping` comment heartbeat every 15 s. Headers match the ping stream (`no-cache, no-transform`, `X-Accel-Buffering: no`). Each connection gets a personalised `you` object (id, rank, score, badge) alongside the shared top 10 and the total; the rank map is built once per push. At most 2000 connections are accepted; further ones get 503. Alternative: WebSockets - rejected, one-way server push over plain HTTP is enough and is already proven through the proxy.

**6. Polling fallback.** `GET /api/standings` returns the same JSON as a snapshot message and also registers the viewer. The page opens an `EventSource`; if it errors, or no message arrives for 25 s (the 10 s snapshots make silence meaningful), it polls `/api/standings` every 3 s while the browser keeps trying to reconnect the stream, and stops polling once a message arrives on the stream again. Alternative: polling only - rejected, it cannot meet the 1 s update requirement without hammering the server.

**7. Client modules.** A new `public/leaderboard.js` owns the pane, the stream/polling logic and the toasts, so `app.js` stays small; `/leaderboard.js` is added to the static routes. All text uses `textContent`; the existing content-security policy is unchanged. The pane sits below the card in the terminal-style window (`┤ leaderboard.log ├`) listing rank, name, a progress bar, the score as "nx Engineer" (n ticked words); a player who has had a bingo gets a gradient, glowing name with the caption "AGI ACHIEVED" underneath (a caption rather than a column, so it fits narrow phones; the shimmer stops under reduced motion); the viewer's row is highlighted, and when they are outside the top 10 their row follows below a separator.

**8. Toasts.** Compact one-line toasts in a fixed, click-through container at the bottom of the viewport, in a polite live region, with at most 3 visible, each removed after about 6 s, and no animation under reduced motion. They are one line high so three of them do not overlap the card on a 390 by 700 viewport. The winner's own message reads "You got bingo - #n".

**9. Limits.** The store keeps at most 5000 players and drops the least recently seen on overflow (LRU by last-seen). The page shows only the top 10.

**10. Rollout.** Branch `fallback/v2-leaderboard` holds the finished v2. For the live demo, the same change is built on `main`; if it goes wrong, switch the Sliplane deploy branch to the fallback branch. Rolling back to v1 means deploying the `v1` tag. The cookie format is unchanged, so players keep their cards in every direction.

## Risks / Trade-offs

- [Proxy buffers or cuts the stream on some networks] → 10 s application-level snapshots plus a 25 s stall watchdog and a 3 s polling fallback.
- [Replaying an older cookie triggers repeat announcements] → Store-side `announced` flag; after a restart at most one extra announcement per player.
- [A redeploy during the demo empties the standings] → Pages reconnect within seconds (EventSource retry 3 s) and re-register silently; scores and badges return, bingo placement numbers do not.
- [Spamming `/api/mark` floods clients with updates] → Pushes are coalesced to one per 150 ms.
- [Memory growth] → 5000-player cap with LRU eviction and a 2000-connection cap.
- [Rude nicknames become visible to the whole room] → Only the v1 length and character limits; moderation stays out of scope, and the presenter can redeploy in an emergency.
- [Ties after a restart are ordered arbitrarily] → Accepted; only the score order matters for the demo.

## Migration Plan

1. Implement and verify v2 on `fallback/v2-leaderboard` (tests plus a two-browser run locally).
2. Live demo: build the same change on `main`; deploy by pushing. If it fails, switch the Sliplane deploy branch to `fallback/v2-leaderboard`.
3. After a deploy, confirm that existing cards survive (unchanged cookie format) and that standings refill as pages reconnect.
4. Rollback: deploy the `v1` tag or the previous commit.
