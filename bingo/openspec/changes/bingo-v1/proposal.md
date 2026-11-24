# Proposal

## Why

The talk "Spec me if you can" needs a playable AI-buzzword bingo that the audience can already use when the presentation starts. During the live demo, a leaderboard with live standings and bingo popups will be added on top of it. This v1 must therefore be deployed beforehand and must keep every player's card and crossed words intact across the later redeployment.

## What Changes

- New web app (Node + TypeScript server, plain page, one Docker image) deployed on Sliplane.
- Each visitor gets a random 5x5 bingo card drawn from an append-only list of AI buzzwords; the center cell is a free, pre-marked pizza.
- Players tick and untick words; the app detects a bingo (row, column, diagonal) and shows a local "you got a bingo" message.
- Card, marks and player id are stored in a signed, versioned cookie. The server owns the cookie: ticking goes through `POST /mark`, which verifies the cookie, flips the cell and re-signs it.
- The cookie format is a stable contract so that cards survive redeployments and the v2 leaderboard can read it without a version bump. It already contains an anonymous player id, an optional nickname and a "first bingo announced" flag for v2.
- Players can set an optional nickname (1-20 characters, changeable at any time); until then they show as an anonymous label such as "Player 4F2A". The nickname is stored in the cookie and always rendered as plain text.
- Compact terminal-style interface (title bar, status segments, one-line name prompt, TUI card pane, status line) on a starfield background, built so the whole card is visible without scrolling on a phone; an AGI progress indicator shows ticked words as a percentage of 24.
- Tiles update instantly in place with no click animation; decorative motion stops for visitors who prefer reduced motion.
- First-visit boot sequence (ASCII-art logo and typed boot log, skippable, replayable with `?boot`) shown once per browser.
- A small SSE test endpoint with a heartbeat, to verify before the talk that Sliplane's proxy passes long-lived streams.

## Capabilities

### New Capabilities
- `card-generation`: random 5x5 card from the append-only buzzword list, 24 distinct words plus the free pizza center.
- `card-marking`: ticking and unticking cells via the server, and bingo detection for rows, columns and diagonals with the pizza counting as ticked.
- `state-persistence`: the signed, versioned cookie that stores card, marks, player id, nickname and announcement flag, and its compatibility rules across redeployments.
- `player-nickname`: optional, validated, changeable player nickname with an anonymous fallback label, persisted in the cookie and rendered safely as plain text.
- `first-visit-intro`: the skippable, once-per-browser boot sequence, its replay switch, and its reduced-motion and no-storage behavior.
- `game-interface`: the compact terminal-style page: card visible without scrolling, progress indicator, instant tile updates, reduced motion, and a self-contained page.

### Modified Capabilities

None. The leaderboard (v2) is a separate later change.

## Impact

- New project code in `bingo/` (server, page, Dockerfile, buzzword list); nothing in the parent presentation project is touched.
- Static assets served by the app: `style.css`, `app.js`, `stars.js` (starfield) and `boot.js` (boot sequence); no external fonts, scripts or styles, so the strict content-security policy stays.
- Deployment: Sliplane service built from the `bingo/Dockerfile` in the GitHub repository and redeployed by pushing to the configured branch; needs a fixed `COOKIE_SECRET` environment variable and a stable HTTPS domain.
- Out of scope: leaderboard, live standings, bingo broadcast popups, nickname moderation, persistent storage, custom web fonts (system fonts only).
