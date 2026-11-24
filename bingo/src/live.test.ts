import { after, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type http from "node:http";
import { FREE_MASK } from "./card.ts";
import { Leaderboard } from "./leaderboard.ts";
import type { PlayerState } from "./cookie.ts";
import { createApp, type AppOptions } from "./server.ts";

const SECRET = "test-secret-with-enough-length";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- helpers

const servers: http.Server[] = [];
const streamsToClose: AbortController[] = [];

after(() => {
  for (const controller of streamsToClose) controller.abort();
  for (const server of servers) {
    server.closeAllConnections();
    server.close();
  }
});

async function start(options: Partial<AppOptions> = {}): Promise<string> {
  const server = createApp({ secret: SECRET, ...options });
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

interface Row {
  id: string;
  name: string;
  score: number;
  badge: boolean;
}
interface Standings {
  top: Row[];
  total: number;
  you: (Row & { rank: number }) | null;
}
interface Player {
  base: string;
  cookie: string;
}

const cookieOf = (res: Response) => res.headers.get("set-cookie")?.split(";")[0];

async function newPlayer(base: string): Promise<Player> {
  const res = await fetch(`${base}/api/card`);
  return { base, cookie: cookieOf(res)! };
}

async function post(player: Player, path: string, body: unknown): Promise<Response> {
  const res = await fetch(`${player.base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: player.cookie },
    body: JSON.stringify(body),
  });
  const next = cookieOf(res);
  if (next) player.cookie = next;
  return res;
}

async function mark(player: Player, ...cells: number[]): Promise<{ newBingo: boolean }> {
  let last = { newBingo: false };
  for (const cell of cells) {
    const res = await post(player, "/api/mark", { cell });
    assert.equal(res.status, 200);
    last = (await res.json()) as { newBingo: boolean };
  }
  return last;
}

async function rename(player: Player, nickname: string): Promise<void> {
  assert.equal((await post(player, "/api/nickname", { nickname })).status, 200);
}

async function standings(base: string, cookie?: string): Promise<Standings> {
  const res = await fetch(`${base}/api/standings`, { headers: cookie ? { Cookie: cookie } : {} });
  assert.equal(res.status, 200);
  return (await res.json()) as Standings;
}

interface SseEvent {
  event: string;
  data: any;
  at: number;
}
interface Sse {
  events: SseEvent[];
  raw: string;
  waitFor(match: (e: SseEvent) => boolean, ms?: number): Promise<SseEvent | undefined>;
  close(): void;
}

/** Open an event stream and collect its events. */
async function openSse(base: string, cookie?: string): Promise<Sse> {
  const controller = new AbortController();
  streamsToClose.push(controller);
  const res = await fetch(`${base}/api/events`, {
    headers: cookie ? { Cookie: cookie } : {},
    signal: controller.signal,
  });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type")!, /text\/event-stream/);
  const sse: Sse = {
    events: [],
    raw: "",
    async waitFor(match, ms = 2000) {
      const start = Date.now();
      while (Date.now() - start < ms) {
        const hit = sse.events.find(match);
        if (hit) return hit;
        await sleep(10);
      }
      return undefined;
    },
    close: () => controller.abort(),
  };
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  void (async () => {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        sse.raw += chunk;
        buffer += chunk;
        let end: number;
        while ((end = buffer.indexOf("\n\n")) >= 0) {
          const block = buffer.slice(0, end);
          buffer = buffer.slice(end + 2);
          const event = /^event: (.+)$/m.exec(block)?.[1];
          const data = /^data: (.+)$/m.exec(block)?.[1];
          if (event && data) sse.events.push({ event, data: JSON.parse(data), at: Date.now() });
        }
      }
    } catch {
      /* aborted */
    }
  })();
  return sse;
}

const isStandings = (e: SseEvent) => e.event === "standings";
const isBingo = (e: SseEvent) => e.event === "bingo";
const row = (s: Standings, name: string) => s.top.find((r) => r.name === name);

// ---------------------------------------------------------------- 2.1 GET /api/standings

test("standings: shape, and a viewer without a card is not listed", async () => {
  const base = await start();
  const empty = await standings(base);
  assert.deepEqual(empty, { top: [], total: 0, you: null });

  const player = await newPlayer(base);
  const seen = await standings(base, player.cookie);
  assert.equal(seen.total, 1);
  assert.equal(seen.you!.rank, 1);
  assert.match(seen.you!.name, /^Player [0-9A-F]{4}$/);
  assert.equal(seen.you!.score, 0);
  assert.equal(seen.you!.badge, false);
  assert.match(seen.you!.id, /^[0-9a-f]{12}$/);

  const anonymous = await standings(base);
  assert.equal(anonymous.total, 1, "a visitor without a card is not listed");
  assert.equal(anonymous.you, null);
});

test("standings: a forged cookie creates no entry", async () => {
  const base = await start();
  const player = await newPlayer(base);
  const forged = player.cookie.replace(/^(bingo=)(.)/, (_, p, c) => p + (c === "A" ? "B" : "A"));
  const seen = await standings(base, forged);
  assert.equal(seen.total, 0);
  assert.equal(seen.you, null);
});

test("standings: wrong method is rejected", async () => {
  const base = await start();
  assert.equal((await fetch(`${base}/api/standings`, { method: "POST" })).status, 405);
  assert.equal((await fetch(`${base}/api/events`, { method: "POST" })).status, 405);
});

// ---------------------------------------------------------------- 2.2 hooks in mark and nickname

test("marks and renames show up in the standings", async () => {
  const base = await start();
  const ada = await newPlayer(base);
  await rename(ada, "Ada");
  await mark(ada, 3, 7, 9);
  const grace = await newPlayer(base);
  await rename(grace, "Grace");
  await mark(grace, 3);

  const s = await standings(base, ada.cookie);
  assert.deepEqual(s.top.map((r) => [r.name, r.score]), [["Ada", 3], ["Grace", 1]]);
  assert.equal(s.you!.rank, 1);

  await rename(ada, "Ada L.");
  assert.equal((await standings(base)).top[0]!.name, "Ada L.");
  await mark(ada, 3); // unmark
  assert.equal(row(await standings(base), "Ada L.")!.score, 2);
});

test("a client-supplied score or name in a mark request is ignored", async () => {
  const base = await start();
  const player = await newPlayer(base);
  const res = await post(player, "/api/mark", { cell: 3, score: 24, name: "Cheater", announced: true });
  assert.equal(res.status, 200);
  const s = await standings(base, player.cookie);
  assert.equal(s.you!.score, 1);
  assert.notEqual(s.you!.name, "Cheater");
  assert.equal(s.you!.badge, false);
});

test("a replayed older cookie never announces a second time", async () => {
  const base = await start();
  const watcher = await openSse(base);
  const player = await newPlayer(base);
  const oldCookie = player.cookie; // from before any mark: announced = false

  await mark(player, 0, 1, 2, 3, 4);
  assert.ok(await watcher.waitFor(isBingo, 1000), "the real first bingo is announced");

  const replay: Player = { base, cookie: oldCookie };
  const result = await mark(replay, 0, 1, 2, 3, 4); // the old cookie thinks it is a first bingo
  assert.equal(result.newBingo, true, "the player's own page still celebrates locally");
  await sleep(500);
  assert.equal(watcher.events.filter(isBingo).length, 1, "but the room is told only once");
  assert.equal((await standings(base)).top[0]!.badge, true);
});

// ---------------------------------------------------------------- 2.3 GET /api/events

test("events: a snapshot arrives at once, personalised with the viewer's own entry", async () => {
  const base = await start();
  const a = await newPlayer(base);
  await rename(a, "Ada");
  const b = await newPlayer(base);
  await rename(b, "Bob");
  const startedAt = Date.now();
  const streamA = await openSse(base, a.cookie);
  const first = await streamA.waitFor(isStandings, 500);
  assert.ok(first, "snapshot within 500 ms");
  assert.ok(first!.at - startedAt < 500);
  assert.equal(first!.data.total, 2);
  assert.equal(first!.data.you.name, "Ada");

  const streamB = await openSse(base, b.cookie);
  const second = await streamB.waitFor(isStandings, 500);
  assert.equal(second!.data.you.name, "Bob");
  assert.deepEqual(first!.data.top.length, 2);

  const anonymous = await openSse(base);
  assert.equal((await anonymous.waitFor(isStandings, 500))!.data.you, null);
});

test("events: a tick by one player reaches the other within 1 second", async () => {
  const base = await start();
  const a = await newPlayer(base);
  const b = await newPlayer(base);
  const streamB = await openSse(base, b.cookie);
  await streamB.waitFor(isStandings, 500);

  const before = Date.now();
  await mark(a, 3);
  const update = await streamB.waitFor((e) => isStandings(e) && e.data.top.some((r: Row) => r.score === 1), 1000);
  assert.ok(update, "update arrived");
  assert.ok(update!.at - before < 1000, `took ${update!.at - before} ms`);
});

test("events: a nickname change reaches the other page within 1 second", async () => {
  const base = await start();
  const a = await newPlayer(base);
  const b = await newPlayer(base);
  const streamB = await openSse(base, b.cookie);
  await streamB.waitFor(isStandings, 500);
  const before = Date.now();
  await rename(a, "Ada");
  const update = await streamB.waitFor((e) => isStandings(e) && e.data.top.some((r: Row) => r.name === "Ada"), 1000);
  assert.ok(update && update.at - before < 1000);
});

test("events: a new player appearing is pushed to everyone", async () => {
  const base = await start();
  const a = await newPlayer(base);
  const streamA = await openSse(base, a.cookie);
  await streamA.waitFor(isStandings, 500);
  const b = await newPlayer(base);
  await openSse(base, b.cookie);
  assert.ok(await streamA.waitFor((e) => isStandings(e) && e.data.total === 2, 1000));
});

test("events: a first bingo is broadcast to every page with its placement", async () => {
  const base = await start();
  const a = await newPlayer(base);
  await rename(a, "Ada");
  const b = await newPlayer(base);
  await rename(b, "Bob");
  const streamA = await openSse(base, a.cookie);
  const streamB = await openSse(base, b.cookie);
  const watcher = await openSse(base);

  await mark(a, 0, 1, 2, 3);
  await sleep(300);
  assert.equal(watcher.events.filter(isBingo).length, 0, "no bingo yet");
  await mark(a, 4);
  for (const sse of [streamA, streamB, watcher]) {
    const hit = await sse.waitFor(isBingo, 1000);
    assert.deepEqual({ name: hit!.data.name, place: hit!.data.place }, { name: "Ada", place: 1 });
    assert.match(hit!.data.id, /^[0-9a-f]{12}$/);
  }
  assert.equal(streamA.events.find(isBingo)!.data.id, (await standings(base, a.cookie)).you!.id, "the winner can recognise themselves");

  await mark(b, 5, 6, 7, 8, 9);
  const second = await watcher.waitFor((e) => isBingo(e) && e.data.name === "Bob", 1000);
  assert.equal(second!.data.place, 2);
  assert.equal(row(await standings(base), "Ada")!.badge, true);
});

test("events: unmarking and completing the same line again announces nothing more", async () => {
  const base = await start();
  const a = await newPlayer(base);
  const watcher = await openSse(base);
  await mark(a, 0, 1, 2, 3, 4);
  await watcher.waitFor(isBingo, 1000);
  await mark(a, 4, 4); // unmark, then complete again
  await sleep(400);
  assert.equal(watcher.events.filter(isBingo).length, 1);
});

test("events: a page connecting after a bingo gets no replay, only the badge", async () => {
  const base = await start();
  const a = await newPlayer(base);
  await rename(a, "Ada");
  await mark(a, 0, 1, 2, 3, 4);
  await sleep(300);
  const late = await openSse(base);
  const snap = await late.waitFor(isStandings, 500);
  await sleep(400);
  assert.equal(late.events.filter(isBingo).length, 0);
  assert.equal(snap!.data.top[0].badge, true);
});

test("events: after a restart players re-register silently with score, name and badge", async () => {
  const before = await start();
  const ada = await newPlayer(before);
  await rename(ada, "Ada");
  await mark(ada, 0, 1, 2, 3, 4); // bingo: the cookie now has announced = true
  const bob = await newPlayer(before);
  await rename(bob, "Bob");
  await mark(bob, 5, 6);

  const after = await start(); // "redeploy": empty store, same secret
  assert.equal((await standings(after)).total, 0);
  const watcher = await openSse(after);
  const adaStream = await openSse(after, ada.cookie);
  const bobStream = await openSse(after, bob.cookie);
  const rebuilt = await watcher.waitFor((e) => isStandings(e) && e.data.total === 2, 1500);
  assert.ok(rebuilt, "the standings refill as pages reconnect");
  assert.deepEqual(
    rebuilt!.data.top.map((r: Row) => [r.name, r.score, r.badge]),
    [["Ada", 5, true], ["Bob", 2, false]],
  );
  await sleep(500);
  for (const sse of [watcher, adaStream, bobStream]) {
    assert.equal(sse.events.filter(isBingo).length, 0, "reconnecting announces nothing");
  }
  // placements restart too: the next real first bingo on the new server is #1
  await mark({ base: after, cookie: bob.cookie }, 7, 8, 9); // Bob already has 5 and 6 in his cookie
  assert.equal((await watcher.waitFor(isBingo, 1000))!.data.place, 1);
});

test("events: updates are coalesced instead of one push per change", async () => {
  const base = await start({ coalesceMs: 200 });
  const a = await newPlayer(base);
  const watcher = await openSse(base);
  await watcher.waitFor(isStandings, 500);
  const pushesBefore = watcher.events.filter(isStandings).length;
  await mark(a, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9);
  await sleep(500);
  const pushes = watcher.events.filter(isStandings).length - pushesBefore;
  assert.ok(pushes >= 1 && pushes <= 3, `${pushes} pushes for 10 changes`);
  assert.equal(watcher.events.filter(isStandings).at(-1)!.data.total, 1);
});

test("events: heartbeats and periodic snapshots keep an idle stream alive", async () => {
  const base = await start({ heartbeatIntervalMs: 40, snapshotIntervalMs: 60 });
  const watcher = await openSse(base);
  await sleep(400);
  assert.ok(watcher.raw.includes(": ping"), "heartbeat comment");
  assert.ok(watcher.events.filter(isStandings).length >= 3, "periodic snapshots without any change");
  assert.ok(watcher.raw.startsWith("retry: 3000"));
});

test("events: the connection cap answers 503, and a closed stream frees its slot", async () => {
  const base = await start({ maxStreams: 2 });
  const one = await openSse(base);
  await openSse(base);
  const refused = await fetch(`${base}/api/events`);
  assert.equal(refused.status, 503);
  one.close();
  await sleep(150);
  const again = await openSse(base);
  assert.ok(await again.waitFor(isStandings, 500));
});

test("events: names reach the stream as data only (no markup is built by the server)", async () => {
  const base = await start();
  const a = await newPlayer(base);
  await rename(a, "<b>x</b>");
  const watcher = await openSse(base);
  const snap = await watcher.waitFor(isStandings, 500);
  assert.equal(snap!.data.top[0].name, "<b>x</b>");
  assert.ok(!/\n[^:\n]*<b>/.test(watcher.raw.replace(/data: .*\n/g, "")), "only inside JSON data lines");
});

// ---------------------------------------------------------------- store: version counter

function state(n: number, marked: number[] = [], extra: Partial<PlayerState> = {}): PlayerState {
  let mask = FREE_MASK;
  for (const cell of marked) mask |= 1 << cell;
  return {
    words: Array.from({ length: 24 }, (_, i) => i),
    mask,
    announced: false,
    playerId: Uint8Array.from([n, 2, 3, 4, 5, 6]),
    nickname: "",
    ...extra,
  };
}

test("the store's version moves only when something visible changes", () => {
  const lb = new Leaderboard({ secret: SECRET, maxPlayers: 2 });
  const v0 = lb.version;
  lb.register(state(1));
  const v1 = lb.version;
  assert.ok(v1 > v0, "a new player is a change");
  lb.register(state(1));
  assert.equal(lb.version, v1, "a plain refresh is not");
  lb.register(state(1, [0]));
  const v2 = lb.version;
  assert.ok(v2 > v1, "a score change is");
  lb.register(state(1, [0], { nickname: "Ada" }));
  const v3 = lb.version;
  assert.ok(v3 > v2, "a rename is");
  lb.register(state(1, [0], { nickname: "Ada", announced: true }));
  const v4 = lb.version;
  assert.ok(v4 > v3, "gaining a badge is");
  const id = lb.register(state(2));
  const v5 = lb.version;
  lb.recordBingo(id);
  assert.ok(lb.version > v5, "recording a bingo is");
  const v6 = lb.version;
  lb.register(state(3)); // evicts the least recently seen
  assert.ok(lb.version > v6, "an eviction is");
});
