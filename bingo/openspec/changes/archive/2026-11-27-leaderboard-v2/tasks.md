# Tasks

## 1. Standings store (leaderboard, bingo-announcements)

- [x] 1.1 Implement the public player id (first 12 hex characters of an HMAC of the player id) and verify unit tests: stable per player, different per player, different per secret, and it never contains the raw id from the cookie
- [x] 1.2 Implement the in-memory `Leaderboard` store (register or refresh from verified state: name, score without the pizza, badge, `reachedAt`) with ranking by score, then earlier `reachedAt`, then id, and verify unit tests for rank order, tie-break, pizza not counted, rename, and a score dropping after unmarking
- [x] 1.3 Add first-bingo recording (`recordBingo` returns a placement once, `announced` never clears, silent registration with `announced=true` gets the badge and no placement) and verify unit tests for placement order, once per player, a replayed older cookie state, and silent registration
- [x] 1.4 Add the 5000-player cap with least-recently-seen eviction and the snapshot builder (top 10, the viewer's `you` with rank, score and badge, total players) and verify unit tests for eviction, the top-10 cut, the viewer outside the top 10, and a viewer without a card

## 2. Live endpoints (leaderboard, bingo-announcements)

- [x] 2.1 Add `GET /api/standings` (JSON snapshot that silently registers the viewer when the cookie verifies and lists nobody otherwise) and verify HTTP tests for the response shape, silent registration, and a forged cookie creating no entry
- [x] 2.2 Hook `POST /api/mark` and `POST /api/nickname` into the store (score and name only from the verified cookie, announce a first bingo only when both the cookie flag and the store say it is new) and verify HTTP tests that standings follow marks and renames, that a client-supplied score is ignored, and that a replayed older cookie never re-announces
- [x] 2.3 Add `GET /api/events` (snapshot on connect, standings pushes coalesced to one per 150 ms, immediate `bingo` events, a snapshot every 10 s, `: ping` heartbeats, 2000-connection cap with 503, cleanup on close) and verify HTTP tests with two streaming clients: the snapshot arrives at once, a tick shows on the other client within 1 s, a first bingo reaches both with its placement, and a reconnect against a fresh server produces no bingo event
- [x] 2.4 Document the new endpoints and the restart behavior in `README.md` and verify the documented `curl` commands for `/api/standings` and `/api/events` run as written

## 3. Page (leaderboard, bingo-announcements, game-interface)

- [x] 3.1 Add the leaderboard pane below the card (`┤ leaderboard.log ├`: top 10 with rank, name, bar, "nx Engineer" score and badge, the viewer's own row highlighted or appended, total players) in the terminal style, fed by `GET /api/standings`, and verify in a headless browser that it renders, the own row is highlighted, and the whole card is still visible on 390x700
- [x] 3.2 Add the `EventSource` client in `public/leaderboard.js` with the 25 s stall watchdog and the 3 s polling fallback, and verify in two headless browsers that a tick in one updates the other within 1 s and that blocking `/api/events` makes a page fall back to polling and recover
- [x] 3.3 Add the bingo toasts (one line, polite live region, at most 3, about 6 s, own variant, no animation under reduced motion) and verify in two headless browsers that a first bingo in one shows a toast in the other exactly once, the winner sees the own variant, and no toast covers the card on 390x700
- [x] 3.4 Verify that nicknames render as plain text in the pane and the toasts using `<b>x</b>` and `<svg onload=__xss=1>` in a headless browser, and extend the server test so no page script uses `innerHTML`
- [x] 3.5 Show players who have had a bingo with a highlighted name and the caption "AGI ACHIEVED" under it (kept after unmarking, plain text, no animation under reduced motion) and verify in two headless browsers that winners carry it and others do not, that it stays after an unmark, that a markup nickname stays inert, and that nothing overflows at 360 px
- [x] 3.6 Add the dancing unicorn on every `bingo` event (one at a time, restart on a new bingo, about 6 s, click-through, no dance under reduced motion) and verify in two headless browsers that a first bingo in one shows a unicorn in both that disappears after about 6 s, that a second bingo during the dance leaves exactly one unicorn, that tapping a cell still works while it dances, that no cell is covered on 390x700, that nothing shows under reduced motion, and that a reconnect shows no unicorn

## 4. Wrap-up

- [x] 4.1 Run the full flow with two browsers against a local server (both listed, ticks update live, a first bingo is announced once to both, a server restart rebuilds the standings silently) and report the result
- [x] 4.2 Run `npm test`, `npm run typecheck` and `openspec validate leaderboard-v2 --strict` and verify all pass

## Workflow follow-up

- Keep `fallback/v2-leaderboard` pushed as the demo fallback.
- Archive this change once it has been reviewed or built live on `main`.
