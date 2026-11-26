import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type http from "node:http";
import { createApp } from "./server.ts";

const SECRET = "test-secret-with-enough-length";

interface Row {
  rank: number;
  id: string;
  name: string;
  score: number;
  badge: boolean;
}
interface Snapshot {
  top: Row[];
  you: Row | null;
  total: number;
}
interface Card {
  nickname: string;
  bingo: boolean;
  newBingo?: boolean;
}
interface Player {
  cookie: string;
}

async function startServer(secret = SECRET): Promise<{ server: http.Server; base: string }> {
  const server = createApp({
    secret,
    pingIntervalMs: 20,
    heartbeatIntervalMs: 40,
    coalesceMs: 20,
    snapshotIntervalMs: 80,
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` };
}

let server: http.Server;
let base: string;
before(async () => {
  ({ server, base } = await startServer());
});
after(() => {
  server.closeAllConnections();
  server.close();
});

const cookieOf = (res: Response) => res.headers.get("set-cookie")?.split(";")[0];

async function newPlayer(at = base): Promise<Player> {
  const res = await fetch(`${at}/api/card`);
  return { cookie: cookieOf(res)! };
}

async function post(path: string, body: unknown, cookie: string, at = base): Promise<Response> {
  return fetch(`${at}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify(body),
  });
}

async function mark(player: Player, cells: number[], at = base): Promise<Card> {
  let card!: Card;
  for (const cell of cells) {
    const res = await post("/api/mark", { cell }, player.cookie, at);
    assert.equal(res.status, 200);
    player.cookie = cookieOf(res)!;
    card = (await res.json()) as Card;
  }
  return card;
}

async function standings(cookie?: string, at = base): Promise<Snapshot> {
  const res = await fetch(`${at}/api/standings`, { headers: cookie ? { Cookie: cookie } : {} });
  assert.equal(res.status, 200);
  return (await res.json()) as Snapshot;
}

interface Message {
  event: string;
  data: any;
}

/** A streaming client for /api/events that collects parsed messages. */
async function openStream(cookie?: string, at = base) {
  const controller = new AbortController();
  const res = await fetch(`${at}/api/events`, {
    headers: cookie ? { Cookie: cookie } : {},
    signal: controller.signal,
  });
  const messages: Message[] = [];
  let raw = "";
  if (res.status === 200) {
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    (async () => {
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) return;
          raw += decoder.decode(value);
          let i;
          while ((i = raw.indexOf("\n\n")) >= 0) {
            const block = raw.slice(0, i);
            raw = raw.slice(i + 2);
            const event = /^event: (.*)$/m.exec(block)?.[1];
            const data = /^data: (.*)$/m.exec(block)?.[1];
            if (event && data) messages.push({ event, data: JSON.parse(data) });
          }
        }
      } catch {
        /* aborted */
      }
    })();
  }
  async function waitFor(predicate: (m: Message) => boolean, ms = 1000): Promise<Message> {
    const deadline = Date.now() + ms;
    let seen = 0;
    while (Date.now() < deadline) {
      for (; seen < messages.length; seen++) if (predicate(messages[seen]!)) return messages[seen]!;
      await new Promise((r) => setTimeout(r, 10));
    }
    throw new Error(`no matching message within ${ms} ms; got ${JSON.stringify(messages)}`);
  }
  return { res, messages, waitFor, close: () => controller.abort() };
}

const ROW = [0, 1, 2, 3, 4];

test("standings: response shape, silent registration, nobody listed without a cookie", async () => {
  const empty = await standings();
  assert.deepEqual(Object.keys(empty).sort(), ["top", "total", "you"]);
  assert.equal(empty.you, null);
  const before = empty.total;

  const player = await newPlayer();
  assert.equal((await standings()).total, before, "a fresh card alone registers nobody");

  const mine = await standings(player.cookie);
  assert.equal(mine.total, before + 1);
  assert.equal(mine.you?.score, 0);
  assert.match(mine.you!.id, /^[0-9a-f]{12}$/);
  assert.equal(mine.you?.badge, false);
});

test("a forged or foreign cookie creates no entry", async () => {
  const before = (await standings()).total;
  const forged = (await newPlayer()).cookie.replace(/.$/, (c) => (c === "A" ? "B" : "A"));
  const snap = await standings(forged);
  assert.equal(snap.you, null);
  assert.equal(snap.total, before);
});

test("standings follow marks and renames; the score comes only from the cookie", async () => {
  const player = await newPlayer();
  await mark(player, [1, 2, 3]);
  let snap = await standings(player.cookie);
  assert.equal(snap.you?.score, 3);
  assert.match(snap.you!.name, /^Player [0-9A-F]{4}$/);

  await mark(player, [2]); // unmark
  assert.equal((await standings(player.cookie)).you?.score, 2);

  player.cookie = cookieOf(await post("/api/nickname", { nickname: "Ada" }, player.cookie))!;
  snap = await standings(player.cookie);
  assert.equal(snap.you?.name, "Ada");
  assert.ok(snap.top.concat(snap.you ? [snap.you] : []).some((r) => r.name === "Ada"));

  // a client-supplied score in a request body is ignored
  const res = await post("/api/mark", { cell: 5, score: 999 }, player.cookie);
  player.cookie = cookieOf(res)!;
  assert.equal((await standings(player.cookie)).you?.score, 3);
});

test("the pizza does not count and ranking follows the score", async () => {
  const { server: s, base: at } = await startServer();
  try {
    const a = await newPlayer(at);
    const b = await newPlayer(at);
    await mark(a, [1], at);
    await mark(b, [1, 2], at);
    await standings(a.cookie, at);
    const snap = await standings(b.cookie, at);
    assert.deepEqual(snap.top.map((r) => r.score), [2, 1]);
    assert.equal(snap.you?.rank, 1);
  } finally {
    s.closeAllConnections();
    s.close();
  }
});

test("a replayed older cookie never announces a second time", async () => {
  const { server: s, base: at } = await startServer();
  try {
    const watcher = await openStream(undefined, at);
    const player = await newPlayer(at);
    const old = player.cookie; // before any bingo
    const card = await mark(player, ROW, at);
    assert.equal(card.newBingo, true);
    await watcher.waitFor((m) => m.event === "bingo");

    // reuse the old copy (no bingo flag) and complete the line again
    const replay: Player = { cookie: old };
    const again = await mark(replay, ROW, at);
    assert.equal(again.bingo, true);
    assert.equal(again.newBingo, false);
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(watcher.messages.filter((m) => m.event === "bingo").length, 1);
    watcher.close();
  } finally {
    s.closeAllConnections();
    s.close();
  }
});

test("events: snapshot at once, ticks and first bingo reach other clients", async () => {
  const { server: s, base: at } = await startServer();
  try {
    const a = await newPlayer(at);
    const b = await newPlayer(at);
    const streamA = await openStream(a.cookie, at);
    const streamB = await openStream(b.cookie, at);
    assert.match(streamA.res.headers.get("content-type")!, /text\/event-stream/);
    assert.equal(streamA.res.headers.get("x-accel-buffering"), "no");

    const first = await streamA.waitFor((m) => m.event === "standings", 200);
    assert.equal(first.data.you.score, 0);

    const started = Date.now();
    await mark(a, [1, 2], at);
    const seen = await streamB.waitFor((m) => m.event === "standings" && m.data.top[0]?.score === 2);
    assert.ok(Date.now() - started < 1000, "a tick shows on the other client within 1 s");
    assert.equal(seen.data.you.score, 0, "each stream gets its own viewer entry");

    await mark(a, [3, 4, 0], at); // row complete
    const bingoA = await streamA.waitFor((m) => m.event === "bingo");
    const bingoB = await streamB.waitFor((m) => m.event === "bingo");
    assert.equal(bingoB.data.place, 1);
    assert.equal(bingoB.data.id, bingoA.data.id);
    assert.equal(bingoB.data.id, first.data.you.id);

    await mark(b, ROW, at);
    const second = await streamA.waitFor((m) => m.event === "bingo" && m.data.place === 2);
    assert.equal(second.data.place, 2);
    const flagged = await streamA.waitFor((m) => m.event === "standings" && m.data.top.every((r: Row) => r.badge));
    assert.ok(flagged);
    streamA.close();
    streamB.close();
  } finally {
    s.closeAllConnections();
    s.close();
  }
});

test("events: heartbeats and periodic snapshots keep the stream alive", async () => {
  const stream = await openStream();
  const a = await stream.waitFor((m) => m.event === "standings");
  assert.equal(a.data.you, null);
  // the next one can only be the periodic snapshot (nothing changed)
  await stream.waitFor((m) => m.event === "standings" && m !== a, 500);
  stream.close();
});

test("events: a reconnect against a fresh server announces nothing and keeps the badge", async () => {
  const { server: s1, base: at1 } = await startServer();
  const player = await newPlayer(at1);
  await mark(player, ROW, at1);
  s1.closeAllConnections();
  s1.close();

  const { server: s2, base: at2 } = await startServer();
  try {
    const stream = await openStream(player.cookie, at2);
    const first = await stream.waitFor((m) => m.event === "standings");
    assert.equal(first.data.you.badge, true);
    assert.equal(first.data.you.score, 5);
    assert.equal(first.data.total, 1);
    await new Promise((r) => setTimeout(r, 250));
    assert.equal(stream.messages.filter((m) => m.event === "bingo").length, 0);
    // later ticks on the reconnected player stay silent as well
    await mark(player, [9], at2);
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(stream.messages.filter((m) => m.event === "bingo").length, 0);
    stream.close();
  } finally {
    s2.closeAllConnections();
    s2.close();
  }
});

test("events: a forged cookie still gets the stream but no own entry", async () => {
  const stream = await openStream("bingo=forged.value");
  const first = await stream.waitFor((m) => m.event === "standings");
  assert.equal(first.data.you, null);
  stream.close();
});

test("events and standings reject wrong methods", async () => {
  assert.equal((await post("/api/events", {}, "x=y")).status, 405);
  assert.equal((await post("/api/standings", {}, "x=y")).status, 405);
});
