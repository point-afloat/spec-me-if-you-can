import http from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { CELLS, CENTER, hasBingo, isMarked, isValidCell, markedWordCount, toggle, wordIdAt } from "./card.ts";
import { newPlayerState, sign, verify, type PlayerState } from "./cookie.ts";
import { Leaderboard, publicId } from "./leaderboard.ts";
import { displayName, validateNickname } from "./nickname.ts";
import { WORDS } from "./words.ts";

const COOKIE_NAME = "bingo";
const COOKIE_MAX_AGE_SECONDS = 14 * 24 * 60 * 60; // 14 days, spec requires at least 7
const MAX_BODY_BYTES = 1024;
const MAX_STREAMS = 2000;

export interface AppOptions {
  /** HMAC secret for the player cookie. Must stay the same across redeployments. */
  secret: string;
  /** Set the Secure cookie flag (default true). Only disable for local http development. */
  secureCookies?: boolean;
  /** Interval of the SSE test stream events (default 5 s) and heartbeats (default 15 s). */
  pingIntervalMs?: number;
  heartbeatIntervalMs?: number;
  /** Standings stream: coalescing window for pushes (default 150 ms), full snapshot interval (default 10 s). */
  coalesceMs?: number;
  snapshotIntervalMs?: number;
}

const STATIC_FILES: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/app.js": { file: "app.js", type: "text/javascript; charset=utf-8" },
  "/leaderboard.js": { file: "leaderboard.js", type: "text/javascript; charset=utf-8" },
  "/stars.js": { file: "stars.js", type: "text/javascript; charset=utf-8" },
  "/boot.js": { file: "boot.js", type: "text/javascript; charset=utf-8" },
  "/style.css": { file: "style.css", type: "text/css; charset=utf-8" },
};
const PUBLIC_DIR = new URL("../public/", import.meta.url);

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; frame-ancestors 'none'",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
};

interface CardView {
  cells: { cell: number; word: string | null; marked: boolean; free: boolean }[];
  bingo: boolean;
  nickname: string;
  label: string;
}

function view(state: PlayerState): CardView {
  const cells = [];
  for (let cell = 0; cell < CELLS; cell++) {
    const id = wordIdAt(state.words, cell);
    cells.push({
      cell,
      word: id === null ? null : (WORDS[id] ?? null),
      marked: isMarked(state.mask, cell),
      free: cell === CENTER,
    });
  }
  return {
    cells,
    bingo: hasBingo(state.mask),
    nickname: state.nickname,
    label: displayName(state.nickname, state.playerId),
  };
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = part.slice(i + 1).trim();
  }
  return out;
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new HttpError(413, "body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch {
        reject(new HttpError(400, "invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function createApp(options: AppOptions): http.Server {
  const { secret } = options;
  const secure = options.secureCookies ?? true;
  const pingMs = options.pingIntervalMs ?? 5000;
  const heartbeatMs = options.heartbeatIntervalMs ?? 15000;
  const coalesceMs = options.coalesceMs ?? 150;
  const snapshotMs = options.snapshotIntervalMs ?? 10000;
  const board = new Leaderboard();

  interface Stream {
    res: http.ServerResponse;
    viewerId: string | null;
  }
  const streams = new Set<Stream>();
  let pushTimer: NodeJS.Timeout | null = null;

  /** Register (or refresh) a player from verified cookie state. Returns their public id. */
  function register(state: PlayerState, hadBingo: boolean = state.announced): string {
    const id = publicId(secret, state.playerId);
    if (board.register(id, displayName(state.nickname, state.playerId), markedWordCount(state.mask), hadBingo)) {
      schedulePush();
    }
    return id;
  }

  function sendEvent(stream: Stream, event: string, data: unknown): void {
    stream.res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  function pushStandings(): void {
    const ranking = board.ranking();
    for (const stream of streams) sendEvent(stream, "standings", board.snapshot(stream.viewerId, ranking));
  }

  /** Coalesce bursts of changes into at most one push per window. */
  function schedulePush(): void {
    if (pushTimer || streams.size === 0) return;
    pushTimer = setTimeout(() => {
      pushTimer = null;
      pushStandings();
    }, coalesceMs);
    pushTimer.unref();
  }

  function announceBingo(id: string, place: number): void {
    const name = board.nameOf(id) ?? "";
    for (const stream of streams) sendEvent(stream, "bingo", { id, name, place });
    schedulePush();
  }

  // Application-level keep-alive: a full snapshot every few seconds lets pages detect a stalled stream.
  const keepAlive = setInterval(() => {
    if (streams.size > 0) pushStandings();
  }, snapshotMs);
  const heartbeat = setInterval(() => {
    for (const stream of streams) stream.res.write(": ping\n\n");
  }, heartbeatMs);
  keepAlive.unref();
  heartbeat.unref();

  function cookieHeader(state: PlayerState): string {
    const attrs = [
      `${COOKIE_NAME}=${sign(state, secret)}`,
      `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
    ];
    if (secure) attrs.push("Secure");
    return attrs.join("; ");
  }

  function sendJson(
    res: http.ServerResponse,
    status: number,
    body: unknown,
    state?: PlayerState,
  ): void {
    const headers: http.OutgoingHttpHeaders = {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...SECURITY_HEADERS,
    };
    if (state) headers["Set-Cookie"] = cookieHeader(state);
    res.writeHead(status, headers);
    res.end(JSON.stringify(body));
  }

  function currentPlayer(req: http.IncomingMessage): PlayerState | null {
    return verify(parseCookies(req.headers.cookie)[COOKIE_NAME], secret);
  }

  function handleStandings(req: http.IncomingMessage, res: http.ServerResponse): void {
    const state = currentPlayer(req);
    const viewerId = state ? register(state) : null;
    sendJson(res, 200, board.snapshot(viewerId));
  }

  function handleEvents(req: http.IncomingMessage, res: http.ServerResponse): void {
    if (streams.size >= MAX_STREAMS) throw new HttpError(503, "too many connections");
    const state = currentPlayer(req);
    const viewerId = state ? register(state) : null;
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...SECURITY_HEADERS,
    });
    res.write("retry: 3000\n\n");
    const stream: Stream = { res, viewerId };
    streams.add(stream);
    sendEvent(stream, "standings", board.snapshot(viewerId));
    req.on("close", () => streams.delete(stream));
  }

  function handlePingStream(req: http.IncomingMessage, res: http.ServerResponse): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...SECURITY_HEADERS,
    });
    res.write("retry: 3000\n\n");
    let n = 0;
    const events = setInterval(() => {
      res.write(`id: ${++n}\ndata: ${JSON.stringify({ n, t: new Date().toISOString() })}\n\n`);
    }, pingMs);
    const heartbeat = setInterval(() => res.write(": ping\n\n"), heartbeatMs);
    req.on("close", () => {
      clearInterval(events);
      clearInterval(heartbeat);
    });
  }

  async function route(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const { pathname } = new URL(req.url ?? "/", "http://localhost");
    const method = req.method ?? "GET";

    const asset = STATIC_FILES[pathname];
    if (asset) {
      if (method !== "GET" && method !== "HEAD") throw new HttpError(405, "method not allowed");
      const body = await readFile(new URL(asset.file, PUBLIC_DIR));
      res.writeHead(200, { "Content-Type": asset.type, "Cache-Control": "no-cache", ...SECURITY_HEADERS });
      res.end(method === "HEAD" ? undefined : body);
      return;
    }

    switch (pathname) {
      case "/healthz":
        res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" });
        res.end("ok");
        return;

      case "/api/standings":
        if (method !== "GET") throw new HttpError(405, "method not allowed");
        handleStandings(req, res);
        return;

      case "/api/events":
        if (method !== "GET") throw new HttpError(405, "method not allowed");
        handleEvents(req, res);
        return;

      case "/api/ping-stream":
        if (method !== "GET") throw new HttpError(405, "method not allowed");
        handlePingStream(req, res);
        return;

      case "/api/card": {
        if (method !== "GET") throw new HttpError(405, "method not allowed");
        const existing = currentPlayer(req);
        if (existing) return sendJson(res, 200, view(existing));
        const fresh = newPlayerState();
        return sendJson(res, 200, view(fresh), fresh);
      }

      case "/api/mark": {
        if (method !== "POST") throw new HttpError(405, "method not allowed");
        const body = (await readJsonBody(req)) as { cell?: unknown } | null;
        const state = currentPlayer(req);
        if (!state) throw new HttpError(401, "no valid card cookie");
        const cell = body?.cell;
        if (!isValidCell(cell)) throw new HttpError(400, "cell must be an integer from 0 to 24");
        const mask = toggle(state.mask, cell);
        const bingo = hasBingo(mask);
        const next: PlayerState = { ...state, mask, announced: state.announced || bingo };
        // Register with the cookie's flag from before this click, so the store can still hand out the placement.
        const id = register(next, state.announced);
        // Announce only when the cookie and the store both say it is the first time:
        // the store closes the replay of an older cookie copy within a server run.
        const place = bingo && !state.announced ? board.recordBingo(id) : null;
        if (place !== null) announceBingo(id, place);
        return sendJson(res, 200, { ...view(next), newBingo: place !== null }, next);
      }

      case "/api/nickname": {
        if (method !== "POST") throw new HttpError(405, "method not allowed");
        const body = (await readJsonBody(req)) as { nickname?: unknown } | null;
        const state = currentPlayer(req);
        if (!state) throw new HttpError(401, "no valid card cookie");
        const nickname = validateNickname(body?.nickname);
        if (nickname === null) {
          throw new HttpError(400, "nickname must be 1-20 characters without control characters");
        }
        const next: PlayerState = { ...state, nickname };
        register(next);
        return sendJson(res, 200, view(next), next);
      }
    }

    throw new HttpError(404, "not found");
  }

  const server = http.createServer((req, res) => {
    route(req, res).catch((err: unknown) => {
      if (res.headersSent) {
        res.destroy();
        return;
      }
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error(err);
      sendJson(res, status, { error: err instanceof HttpError ? err.message : "internal error" });
    });
  });
  server.on("close", () => {
    clearInterval(keepAlive);
    clearInterval(heartbeat);
    if (pushTimer) clearTimeout(pushTimer);
  });
  return server;
}

function main(): void {
  const secret = process.env.COOKIE_SECRET;
  if (!secret || secret.length < 16) {
    console.error(
      "COOKIE_SECRET is required (at least 16 characters) and must stay the same across redeployments.\n" +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    );
    process.exit(1);
  }
  const port = Number(process.env.PORT ?? 3000);
  const secureCookies = process.env.DEV_INSECURE_COOKIES !== "1";
  createApp({ secret, secureCookies }).listen(port, () => {
    console.log(`bingo listening on http://localhost:${port}${secureCookies ? "" : " (insecure dev cookies)"}`);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
