import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type http from "node:http";
import { CENTER } from "./card.ts";
import { createApp } from "./server.ts";

const SECRET = "test-secret-with-enough-length";
let server: http.Server;
let base: string;

before(async () => {
  server = createApp({ secret: SECRET, pingIntervalMs: 20, heartbeatIntervalMs: 30 });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.closeAllConnections();
  server.close();
});

interface Cell {
  cell: number;
  word: string | null;
  marked: boolean;
  free: boolean;
}
interface Card {
  cells: Cell[];
  bingo: boolean;
  nickname: string;
  label: string;
  newBingo?: boolean;
  error?: string;
}

/** The cookie pair ("bingo=...") from a response, or undefined if none was set. */
function cookieOf(res: Response): string | undefined {
  return res.headers.get("set-cookie")?.split(";")[0];
}

async function newPlayer(): Promise<{ cookie: string; card: Card }> {
  const res = await fetch(`${base}/api/card`);
  const cookie = cookieOf(res)!;
  assert.ok(cookie, "a new visitor gets a cookie");
  return { cookie, card: (await res.json()) as Card };
}

async function post(path: string, body: unknown, cookie?: string): Promise<Response> {
  return fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: JSON.stringify(body),
  });
}

/** Mark cells, always carrying the newest cookie forward. */
async function markAll(player: { cookie: string }, cells: number[]): Promise<Card> {
  let card!: Card;
  for (const cell of cells) {
    const res = await post("/api/mark", { cell }, player.cookie);
    assert.equal(res.status, 200);
    player.cookie = cookieOf(res)!;
    card = (await res.json()) as Card;
  }
  return card;
}

test("healthz and the page are served", async () => {
  assert.equal((await fetch(`${base}/healthz`)).status, 200);
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<title>AI Bingo<\/title>/);
  for (const asset of ["/app.js", "/leaderboard.js", "/stars.js", "/boot.js", "/style.css"]) {
    assert.equal((await fetch(`${base}${asset}`)).status, 200, asset);
  }
  assert.equal((await fetch(`${base}/nope`)).status, 404);
});

test("a fresh visit gets a card and a hardened cookie", async () => {
  const res = await fetch(`${base}/api/card`);
  const setCookie = res.headers.get("set-cookie")!;
  assert.match(setCookie, /^bingo=/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /SameSite=Lax/);
  const maxAge = Number(/Max-Age=(\d+)/.exec(setCookie)![1]);
  assert.ok(maxAge >= 7 * 24 * 60 * 60);

  const card = (await res.json()) as Card;
  assert.equal(card.cells.length, 25);
  const center = card.cells[CENTER]!;
  assert.deepEqual([center.free, center.marked, center.word], [true, true, null]);
  const words = card.cells.filter((c) => !c.free).map((c) => c.word);
  assert.equal(words.length, 24);
  assert.equal(new Set(words).size, 24);
  assert.equal(card.cells.filter((c) => c.marked).length, 1);
  assert.equal(card.nickname, "");
  assert.match(card.label, /^Player [0-9A-F]{4}$/);
  assert.equal(card.bingo, false);
});

test("a returning player gets the same card and marks", async () => {
  const player = await newPlayer();
  const marked = await markAll(player, [3, 7]);
  const res = await fetch(`${base}/api/card`, { headers: { Cookie: player.cookie } });
  assert.equal(res.headers.get("set-cookie"), null, "no new cookie for a valid one");
  const again = (await res.json()) as Card;
  assert.deepEqual(again.cells, marked.cells);
  assert.equal(again.label, marked.label);
});

test("marking and unmarking a word", async () => {
  const player = await newPlayer();
  let card = await markAll(player, [7]);
  assert.equal(card.cells[7]!.marked, true);
  card = await markAll(player, [7]);
  assert.equal(card.cells[7]!.marked, false);
});

test("clicking the center changes nothing", async () => {
  const player = await newPlayer();
  const card = await markAll(player, [CENTER]);
  assert.equal(card.cells[CENTER]!.marked, true);
  assert.equal(card.cells.filter((c) => c.marked).length, 1);
});

test("out-of-range and malformed cells are rejected without a new cookie", async () => {
  const { cookie } = await newPlayer();
  for (const cell of [-1, 25, 1.5, "3", null, undefined]) {
    const res = await post("/api/mark", { cell }, cookie);
    assert.equal(res.status, 400);
    assert.equal(res.headers.get("set-cookie"), null);
  }
  assert.equal((await post("/api/mark", "nonsense", cookie)).status, 400);
});

test("missing or forged cookies cannot mark", async () => {
  assert.equal((await post("/api/mark", { cell: 1 })).status, 401);
  const { cookie } = await newPlayer();
  const forged = cookie.replace(/^(bingo=)(.)/, (_, p, c) => p + (c === "A" ? "B" : "A"));
  const res = await post("/api/mark", { cell: 1 }, forged);
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("set-cookie"), null);

  // A forged cookie is treated like a new visitor on the next page load.
  const reload = await fetch(`${base}/api/card`, { headers: { Cookie: forged } });
  assert.ok(cookieOf(reload));
  assert.notEqual(cookieOf(reload), forged);
});

test("cookies signed with another secret are rejected (redeploy with a changed secret)", async () => {
  const other = createApp({ secret: "a-completely-different-secret" });
  await new Promise<void>((resolve) => other.listen(0, "127.0.0.1", resolve));
  const otherBase = `http://127.0.0.1:${(other.address() as AddressInfo).port}`;
  try {
    const res = await fetch(`${otherBase}/api/card`);
    const foreign = cookieOf(res)!;
    assert.equal((await post("/api/mark", { cell: 1 }, foreign)).status, 401);
  } finally {
    other.close();
  }
});

test("completing a line shows a bingo once; unmarking clears it but keeps the announcement", async () => {
  const player = await newPlayer();
  let card = await markAll(player, [0, 1, 2, 3]);
  assert.equal(card.bingo, false);
  assert.equal(card.newBingo, false);

  card = await markAll(player, [4]);
  assert.equal(card.bingo, true);
  assert.equal(card.newBingo, true);

  card = await markAll(player, [4]); // unmark
  assert.equal(card.bingo, false);
  assert.equal(card.newBingo, false);

  card = await markAll(player, [4]); // complete the same line again
  assert.equal(card.bingo, true);
  assert.equal(card.newBingo, false, "the first bingo was already announced");

  // The announced flag survives a reload (it lives in the cookie).
  const reload = await fetch(`${base}/api/card`, { headers: { Cookie: player.cookie } });
  assert.equal(((await reload.json()) as Card).bingo, true);
});

test("a diagonal bingo needs only four words", async () => {
  const player = await newPlayer();
  const card = await markAll(player, [0, 6, 18, 24]);
  assert.equal(card.bingo, true);
});

test("setting, trimming and changing a nickname keeps the card and marks", async () => {
  const player = await newPlayer();
  await markAll(player, [3, 9]);

  let res = await post("/api/nickname", { nickname: "  Ada  " }, player.cookie);
  assert.equal(res.status, 200);
  player.cookie = cookieOf(res)!;
  let card = (await res.json()) as Card;
  assert.equal(card.nickname, "Ada");
  assert.equal(card.label, "Ada");
  assert.deepEqual(
    card.cells.filter((c) => c.marked).map((c) => c.cell),
    [3, 9, CENTER],
  );

  res = await post("/api/nickname", { nickname: "Grace" }, player.cookie);
  player.cookie = cookieOf(res)!;
  card = (await res.json()) as Card;
  assert.equal(card.nickname, "Grace");
  assert.deepEqual(
    card.cells.filter((c) => c.marked).map((c) => c.cell),
    [3, 9, CENTER],
  );

  const reload = await fetch(`${base}/api/card`, { headers: { Cookie: player.cookie } });
  assert.equal(((await reload.json()) as Card).nickname, "Grace");
});

test("invalid nicknames are rejected and the old name is kept", async () => {
  const player = await newPlayer();
  const ok = await post("/api/nickname", { nickname: "Ada" }, player.cookie);
  player.cookie = cookieOf(ok)!;

  for (const bad of ["", "   ", "x".repeat(21), "a\u0000b", "a\nb", 42, null]) {
    const res = await post("/api/nickname", { nickname: bad }, player.cookie);
    assert.equal(res.status, 400);
    assert.equal(res.headers.get("set-cookie"), null);
  }
  const reload = await fetch(`${base}/api/card`, { headers: { Cookie: player.cookie } });
  assert.equal(((await reload.json()) as Card).nickname, "Ada");
});

test("nickname requires a valid cookie", async () => {
  assert.equal((await post("/api/nickname", { nickname: "Ada" })).status, 401);
  const { cookie } = await newPlayer();
  const forged = cookie.replace(/^(bingo=)(.)/, (_, p, c) => p + (c === "A" ? "B" : "A"));
  assert.equal((await post("/api/nickname", { nickname: "Ada" }, forged)).status, 401);
});

test("duplicate nicknames are accepted", async () => {
  const a = await newPlayer();
  const b = await newPlayer();
  assert.equal((await post("/api/nickname", { nickname: "Ada" }, a.cookie)).status, 200);
  assert.equal((await post("/api/nickname", { nickname: "Ada" }, b.cookie)).status, 200);
});

test("a markup nickname is returned as inert text and the page never uses innerHTML", async () => {
  const player = await newPlayer();
  const name = "<script>x</script>";
  const res = await post("/api/nickname", { nickname: name }, player.cookie);
  assert.equal(res.status, 200);
  assert.equal(((await res.json()) as Card).nickname, name, "stored verbatim, escaped only when rendered");
  assert.match(res.headers.get("content-type")!, /^application\/json/);

  for (const script of ["/app.js", "/boot.js", "/stars.js", "/leaderboard.js"]) {
    const client = await (await fetch(`${base}${script}`)).text();
    assert.doesNotMatch(client, /innerHTML|outerHTML|insertAdjacentHTML|document\.write/, script);
  }
  const page = await fetch(`${base}/`);
  assert.match(page.headers.get("content-security-policy")!, /default-src 'self'/);
});

test("wrong methods and oversized bodies are rejected", async () => {
  const { cookie } = await newPlayer();
  assert.equal((await fetch(`${base}/api/mark`, { headers: { Cookie: cookie } })).status, 405);
  assert.equal((await post("/api/card", {}, cookie)).status, 405);
  const big = await post("/api/nickname", { nickname: "x".repeat(5000) }, cookie).catch(() => null);
  assert.ok(big === null || big.status === 413);
});

test("ping stream sends events one by one with heartbeats", async () => {
  const controller = new AbortController();
  const res = await fetch(`${base}/api/ping-stream`, { signal: controller.signal });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type")!, /text\/event-stream/);
  assert.equal(res.headers.get("x-accel-buffering"), "no");

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  const deadline = Date.now() + 2000;
  while (Date.now() < deadline && !(/data: .*\n\n[\s\S]*data: .*\n\n/.test(text) && text.includes(": ping"))) {
    const { value, done } = await reader.read();
    if (done) break;
    text += decoder.decode(value);
  }
  controller.abort();
  assert.ok((text.match(/^data: /gm) ?? []).length >= 2, "several events arrived");
  assert.ok(text.includes(": ping"), "heartbeat comment arrived");
});
