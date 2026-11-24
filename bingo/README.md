# AI Buzzword Bingo

A small bingo game for the talk "Spec me if you can". Each visitor gets a random 5x5 card of AI buzzwords with a free pizza in the middle, ticks words as they hear them, and can set an optional nickname. All player state lives in a signed cookie, so cards survive page reloads and redeployments.

Planning artifacts (proposal, specs, design, tasks) are in `openspec/changes/`.

## Configuration

| Variable | Required | Meaning |
|---|---|---|
| `COOKIE_SECRET` | yes, 16+ characters | Key that signs the player cookie. **Must stay the same across redeployments**, otherwise every player's card is rejected and replaced. The server refuses to start without it. |
| `PORT` | no (default `3000`) | Port to listen on. |
| `DEV_INSECURE_COOKIES` | no | Set to `1` to drop the `Secure` cookie flag for plain-http local development. Never set it in production. |

Generate a secret with:

```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Run locally

Requires Node 22.18 or newer (it runs the TypeScript sources directly).

```sh
npm install
COOKIE_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") \
DEV_INSECURE_COOKIES=1 npm run dev
```

Then open <http://localhost:3000>. A fresh `COOKIE_SECRET` per run means old cards are replaced on restart; use a fixed value to keep them.

## Scripts

- `npm test`: unit and HTTP tests (Node's built-in test runner)
- `npm run typecheck`: TypeScript check, including tests
- `npm run build`: compile to `dist/`
- `npm start`: run the compiled server

## Docker

```sh
docker build -t bingo .
docker run --rm -p 3000:3000 -e COOKIE_SECRET=<your-secret> -e DEV_INSECURE_COOKIES=1 bingo
```

The image contains no secret; pass `COOKIE_SECRET` as an environment variable (on Sliplane: in the service's environment settings).

## Deploy (Sliplane, via GitHub)

Pushing to the configured branch redeploys the app. In the Sliplane admin panel:

- Connect the GitHub repository. Its root is the presentation project, so tell Sliplane to build from the `bingo/` directory (Dockerfile at `bingo/Dockerfile`, build context `bingo/`).
- Set the environment variable `COOKIE_SECRET` once and never change it (a changed secret invalidates every player's card). Do not set `DEV_INSECURE_COOKIES`.
- Use a stable domain with HTTPS; the cookie is `Secure` and bound to the domain.
- The container listens on `PORT` (default 3000); point Sliplane's port at it.
- A prepared fallback branch lets you switch back quickly if a live change goes wrong.

## Word list rule

`src/words.ts` is **append-only**. A word's position is its id and is stored in player cookies. Only add new words at the end; `src/words.test.ts` fails if a released word moves or disappears.

## Endpoints

- `GET /` the page
- `GET /api/card` create or restore the card
- `POST /api/mark` `{"cell": 0-24}` toggle a cell
- `POST /api/nickname` `{"nickname": "..."}` set the nickname
- `GET /healthz` health check
- `GET /api/ping-stream` server-sent-events test stream (an event every 5 s, a heartbeat every 15 s), used to check that the hosting proxy passes long-lived streams:
  `curl -N http://localhost:3000/api/ping-stream`
