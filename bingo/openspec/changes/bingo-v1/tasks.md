# Tasks

## 1. Project scaffolding

- [x] 1.1 Create `package.json`, `tsconfig.json` and the `src/` layout for a Node + TypeScript server with a test runner, and verify `npm install` and `npm run build` succeed on an empty entry point
- [x] 1.2 Add `.gitignore`, `.dockerignore` and a README stub describing `COOKIE_SECRET` and `PORT`, and verify the README commands run as written

## 2. Card logic (card-generation, card-marking)

- [x] 2.1 Add the buzzword list (at least 40 words, append-only) with a snapshot test pinning the released words, and verify the test fails when a word is reordered or removed and passes when one is appended
- [x] 2.2 Implement card generation (24 distinct random words, random placement, pizza center) and verify unit tests for layout, no duplicates and the center cell
- [x] 2.3 Implement toggle with the fixed center cell and cell range validation, and verify unit tests for mark, unmark, center click and out-of-range cells
- [x] 2.4 Implement bingo detection for all 12 lines with the pizza counted as marked, and verify unit tests for row, column, both diagonals (four words only) and the no-bingo case

## 3. Cookie state (state-persistence)

- [x] 3.1 Implement the binary payload codec (version, 24 indices, 25-bit mask, flags, player id, length-prefixed nickname) and verify a round-trip test and a size check well under 4 KB
- [x] 3.2 Implement HMAC signing and verification with the `COOKIE_SECRET` startup check, and verify tests for valid, tampered, wrong-secret and unknown-version cookies
- [x] 3.3 Verify with a test that a cookie created before the word list grows still decodes to the same words, and that a version 1 cookie is accepted by the current reader

## 4. Server and page

- [x] 4.1 Implement `GET /api/card` (create or restore, set cookie with `HttpOnly`, `Secure`, `SameSite=Lax`, 7+ day lifetime) and `GET /healthz`, and verify with HTTP tests that a fresh visit sets the cookie and a return visit gets the same card
- [x] 4.2 Implement `POST /api/mark` with verification, toggling and re-signing, and verify HTTP tests for success, out-of-range cell, missing cookie and forged cookie
- [x] 4.3 Build the page as a compact terminal-style window: 5x5 grid, pizza center, click to toggle through `/api/mark`, and verify by running the app locally and clicking cells through reload
- [x] 4.4 Add the bingo message on the first line completed, dismissed when unmarked, and set the announced flag in the cookie, and verify by completing a row locally and by a test that the flag survives a reload
- [x] 4.5 Add `GET /api/ping-stream` (event every 5 seconds plus a `: ping` heartbeat, buffering disabled) and verify with `curl -N` that events arrive one by one
- [x] 4.6 Style the page as a compact terminal window (title bar, status segments, name prompt, TUI card pane with checkboxes, AGI progress bar, status line) with tiles updated in place, and verify with screenshots at 390x844 and 1000x780 that the whole card is visible without scrolling
- [x] 4.7 Add the first-visit boot sequence (`boot.js`: ASCII logo, typed log, skip on any key or click, `?boot` replay, skipped for reduced motion) and verify in a browser that a fresh profile plays it, a second load skips it, a key press skips it and `?boot` replays it
- [x] 4.8 Add the starfield (`stars.js`), serve `boot.js` and `stars.js`, and verify with tests that every asset is served and that none of the page scripts use `innerHTML`

## 5. Nickname (player-nickname)

- [x] 5.1 Implement nickname validation (trim, 1-20 code points, no control characters) and the "Player XXXX" fallback label, and verify unit tests for valid, empty, too long, control characters, duplicates and a stable fallback
- [x] 5.2 Implement `POST /api/nickname` (validate, store in the cookie, re-sign) and verify HTTP tests for success, rejection keeping the old name, rename after marking leaving marks unchanged, and a forged cookie
- [x] 5.3 Add the optional nickname field to the page, showing the fallback label until a name is set, and verify by running the app locally: set, change and reload keep the name and the card
- [x] 5.4 Render names only with `textContent` and verify with a test (and a manual check) that the nickname `<script>x</script>` shows as plain text and no script runs
- [x] 5.5 Verify that a cookie with a nickname survives the codec round trip and an unchanged restart of the server

## 6. Deployment

- [x] 6.1 Write the multi-stage Dockerfile (non-root, `PORT`, no secret baked in) and verify `docker build` and `docker run` serve the page locally
- [x] 6.2 In the Sliplane admin panel connect the GitHub repository with `bingo/` as Dockerfile directory and build context, set `COOKIE_SECRET` and the domain, push to the deploy branch and tag the commit `v1`, and verify the page loads over HTTPS and a card is created
- [ ] 6.3 Run the ping-stream check from two phones on mobile data for 5 minutes and verify events arrive steadily without gaps or buffering
- [x] 6.4 Redeploy the unchanged app by pushing an empty commit to the deploy branch and verify that an existing card, its marked cells and its nickname are still there
