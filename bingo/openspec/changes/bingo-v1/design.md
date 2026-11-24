# Design

## Context

Greenfield project in `bingo/`; no existing code or specs. It is deployed to Sliplane (Docker, HTTPS, reverse proxy) before the talk and extended live with a leaderboard (v2). See proposal.md for the motivation and the specs for the requirements. The design must keep the v2 diff small and must not need a cookie version bump for v2.

## Goals / Non-Goals

**Goals:**
- Small, dependency-light server: Node + TypeScript, built-in `http` module, plain HTML/JS page, no framework.
- Server owns all card state; the cookie is the only storage, so the server stays stateless in v1.
- Cookie format and bingo logic prepared so v2 only adds a leaderboard store and an event stream.

**Non-Goals:**
- No database, volume or server-side session store.
- No leaderboard, SSE standings, nickname moderation or accounts (later changes).
- No client-side trust: the browser never writes the state cookie itself.

## Decisions

**1. Server-owned, HMAC-signed cookie.** The cookie is `base64url(payload).base64url(hmac)`; ticking calls `POST /mark`, the server verifies, flips the cell and responds with `Set-Cookie`. Alternative: client-side `document.cookie` or localStorage - simpler, but anyone could forge a bingo, which would make v2 pointless. The HMAC secret comes from the `COOKIE_SECRET` environment variable; the app refuses to start without it, so a missing secret can't silently invalidate every card.

**2. Compact binary payload.** Version byte, 24 word indices (one byte each, list stays under 256 words), a 25-bit mark mask (4 bytes, center bit always set), a flags byte (bit 0 = first bingo announced), a 6-byte random player id and a length-prefixed UTF-8 nickname (at most 20 characters, so at most 81 bytes). About 36 bytes without a name and under 120 bytes at most before signing and encoding, far below cookie limits. The nickname is part of format version 1, so no later version bump is needed for it. Alternative: readable JSON - friendlier on a slide but larger and slower to validate. The format is isolated in one module so it can be shown or swapped.

**3. Word list as a TypeScript array, append-only.** Index in the array is the word's id. A unit test pins the first N words (a snapshot of the released list) so that reordering or removal fails the build; only appending passes.

**4. One shared pure module for card logic.** `card.ts` contains generation (Fisher-Yates over the list, 24 picks, random placement), toggle, and bingo detection over the mask (12 line masks). The server uses it for `/mark`; the page gets the card state as JSON from the server and renders it, so no logic is duplicated in the browser. v2 reuses the same detection to rank and announce.

**5. Cookie attributes.** `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, `Max-Age` of 7 days or more. The page does not read the cookie; it fetches `GET /api/card` which returns the decoded card and marks. `SameSite=Lax` instead of `Strict` so players arriving from a QR code scanner or chat link keep their cookie.

**6. Endpoints.** `GET /` and its static assets `/style.css`, `/app.js`, `/stars.js` and `/boot.js` (static page), `GET /api/card` (creates a card if the cookie is missing or invalid, otherwise returns the stored one), `POST /api/mark` (body: cell index), `POST /api/nickname` (body: name; validates, re-signs and sets the cookie, like `/api/mark`), `GET /healthz`, and `GET /api/ping-stream`, an SSE test stream with a message every 5 seconds and a `: ping` comment heartbeat. The ping stream exists only to verify Sliplane's proxy; it is removed or replaced by the real stream in v2.

**7. Pizza center.** Rendered with a pizza emoji; it is pure presentation, so replacing it with an image later does not change any spec.

**8. Nickname handling.** Validation (trim, 1-20 characters counted as code points, no control characters) lives in the shared card module's neighbour `nickname.ts` and is applied only on the server. The page renders names with `textContent`, never `innerHTML`, because in v2 every player's name is shown on everyone's screen. The fallback label "Player XXXX" is derived from the first two bytes of the player id and is not stored. Alternative: a required name before the card appears - rejected, because the card should be instant and a name prompt would cost audience attention.

**9. Container.** Multi-stage Dockerfile: build TypeScript, run `node dist/server.js` as a non-root user, listening on `PORT`.

**10. Terminal-style interface, card first.** The page is one terminal "window": a slim title bar, powerline-style status segments (title, player name, AGI progress), a one-line `$ whoami` prompt, the card as a bordered "pane" with `[ ]` / `[x]` checkboxes in every cell, and a vim-style status line. The big headline lives only in the boot sequence, so the card is visible without scrolling on a 390x700 viewport. Alternative: a large hero header above the card - rejected, it pushed the card below the fold.

**11. In-place tile updates, no click animation.** The grid is built once and tiles are updated by toggling classes and `aria-pressed`, never re-created. Re-creating them replayed the cell fade-in and pop animations on every click and dropped keyboard focus. The only per-cell animation is a staggered fade-in when the grid is first built.

**12. Boot sequence as a head script.** `boot.js` is a classic (non-module) script in `<head>` so it can hide the page content before first paint and avoid a flash of the card. It builds the overlay from fixed text with `textContent`, ends after about 3 seconds, and is skippable by key or pointer. It remembers completion in `localStorage` (`bingo-booted`), wrapped in try/catch so blocked storage only means the intro plays again. `?boot` forces a replay; reduced motion skips it. Alternative: tie the intro to the game cookie so it replays for a new player - not chosen, since the cookie is signed server state and the intro is cosmetic; revisit if "once per player" is wanted.

**13. Starfield and styling constraints.** `stars.js` draws a twinkling canvas starfield with an occasional shooting star, drawn once and still under reduced motion. All styling uses system font stacks and same-origin files, keeping the `default-src 'self'` content-security policy intact; progress bar widths are set through the CSSOM, which that policy allows.

## Risks / Trade-offs

- [Signing secret changes or is lost] → Required env var with a startup check; document it in the README and set it in Sliplane before the first deploy.
- [Domain changes between v1 and the talk] → Fix the domain first; cookies are bound to it.
- [Proxy buffers or times out long-lived streams] → Verify with the ping stream from two phones on mobile data before the talk; v2 adds heartbeats and a polling fallback.
- [Word list edited incorrectly in v2] → Snapshot test fails on reorder or removal.
- [Players who clear cookies get a new card] → Accepted; an anonymous game has no recovery.
- [Rude or misleading nicknames shown to the whole room in v2] → Only a length and character limit in v1; moderation is deferred, and the presenter can redeploy or rotate the secret in an emergency.
- [Markup injection through nicknames] → Plain-text rendering rule plus a test with a `<script>` name.
- [Boot sequence hides the card for about 3 seconds on first visit] → Skippable by any key or tap, shown once per browser, never for reduced motion.
- [Headless or odd browsers show the card mid fade-in] → The fade-in is a one-time 0.3 s per-cell animation with a fill mode that ends fully visible; reduced motion removes it.
- [Monospace text is wider, so long words could break on narrow screens] → Cell font size scales with viewport width and was checked at 390 px.
- [Cookie is not encrypted, only signed] → Acceptable: it contains no personal data.

## Migration Plan

1. In the Sliplane admin panel: connect the GitHub repository, set the build to use `bingo/` as the Dockerfile directory and build context (the repository root is the presentation project), pick the deploy branch, and set `COOKIE_SECRET` and the domain.
2. Deploy by pushing to the deploy branch; tag the commit `v1`.
3. Run the SSE ping-stream check from two phones on mobile data.
4. Redeploy once unchanged and confirm that an existing card and marks survive.
5. Rollback: push or switch the deploy branch back to the previous commit (for example a prepared fallback branch); the cookie format is unchanged so players keep their cards.
