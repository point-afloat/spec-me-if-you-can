import { test } from "node:test";
import assert from "node:assert/strict";
import { CENTER, FREE_MASK } from "./card.ts";
import type { PlayerState } from "./cookie.ts";
import { Leaderboard, publicId } from "./leaderboard.ts";

const SECRET = "test-secret-with-enough-length";

/** A player state with the given marked word cells; `n` makes the player id unique. */
function player(n: number, marked: number[] = [], extra: Partial<PlayerState> = {}): PlayerState {
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

function board(options: { maxPlayers?: number; topSize?: number } = {}): Leaderboard {
  return new Leaderboard({ secret: SECRET, ...options });
}

const names = (lb: Leaderboard) => lb.snapshot(null).top.map((r) => r.name);

// ---------------------------------------------------------------- 1.1 public id

test("public id is stable per player", () => {
  const id = Uint8Array.from([1, 2, 3, 4, 5, 6]);
  assert.equal(publicId(id, SECRET), publicId(Uint8Array.from(id), SECRET));
  assert.match(publicId(id, SECRET), /^[0-9a-f]{12}$/);
});

test("public id differs per player and per secret", () => {
  const a = Uint8Array.from([1, 2, 3, 4, 5, 6]);
  const b = Uint8Array.from([1, 2, 3, 4, 5, 7]);
  assert.notEqual(publicId(a, SECRET), publicId(b, SECRET));
  assert.notEqual(publicId(a, SECRET), publicId(a, "another-secret-entirely"));
});

test("public id never exposes the raw cookie id", () => {
  const raw = Uint8Array.from([0xab, 0xcd, 0xef, 0x01, 0x23, 0x45]);
  const id = publicId(raw, SECRET);
  assert.ok(!id.includes("abcdef012345"));
  assert.notEqual(id, "abcdef012345");
});

// ---------------------------------------------------------------- 1.2 ranking

test("higher score ranks first", () => {
  const lb = board();
  lb.register(player(1, [0], { nickname: "A" }));
  lb.register(player(2, [0, 1, 2, 3, 4], { nickname: "B" }));
  lb.register(player(3, [0, 1], { nickname: "C" }));
  assert.deepEqual(names(lb), ["B", "C", "A"]);
});

test("a tie goes to the player who reached the score first", () => {
  const lb = board();
  lb.register(player(1, [0, 1, 2, 3], { nickname: "A" }));
  lb.register(player(2, [0, 1, 2, 3], { nickname: "B" }));
  assert.deepEqual(names(lb), ["A", "B"]);
  // B pulling ahead and A catching up later reverses nothing about who got there first at 5
  lb.register(player(2, [0, 1, 2, 3, 4], { nickname: "B" }));
  lb.register(player(1, [0, 1, 2, 3, 4], { nickname: "A" }));
  assert.deepEqual(names(lb), ["B", "A"]);
});

test("refreshing with an unchanged score keeps the place in a tie", () => {
  const lb = board();
  lb.register(player(1, [0, 1], { nickname: "A" }));
  lb.register(player(2, [0, 1], { nickname: "B" }));
  lb.register(player(1, [0, 1], { nickname: "A" })); // reconnect, same score
  assert.deepEqual(names(lb), ["A", "B"]);
});

test("the pizza does not count", () => {
  const lb = board();
  lb.register(player(1));
  assert.equal(lb.snapshot(null).top[0]!.score, 0);
  assert.ok(FREE_MASK & (1 << CENTER));
});

test("an anonymous player is shown under the fallback label", () => {
  const lb = board();
  lb.register(player(0x4f));
  assert.match(lb.snapshot(null).top[0]!.name, /^Player 4F02$/);
});

test("renaming updates the entry without moving it", () => {
  const lb = board();
  lb.register(player(1, [0, 1, 2], { nickname: "A" }));
  lb.register(player(2, [0], { nickname: "B" }));
  lb.register(player(1, [0, 1, 2], { nickname: "Ada" }));
  assert.deepEqual(names(lb), ["Ada", "B"]);
});

test("unmarking lowers the score and the rank", () => {
  const lb = board();
  lb.register(player(1, [0, 1, 2], { nickname: "A" }));
  lb.register(player(2, [0, 1], { nickname: "B" }));
  assert.deepEqual(names(lb), ["A", "B"]);
  lb.register(player(1, [0], { nickname: "A" }));
  assert.deepEqual(names(lb), ["B", "A"]);
  assert.equal(lb.snapshot(null).top.find((r) => r.name === "A")!.score, 1);
});

test("markup in a name is kept verbatim (escaping is the page's job)", () => {
  const lb = board();
  lb.register(player(1, [], { nickname: "<b>x</b>" }));
  assert.equal(lb.snapshot(null).top[0]!.name, "<b>x</b>");
});

// ---------------------------------------------------------------- 1.3 bingo recording

test("first bingos get placements 1, 2, 3 in order", () => {
  const lb = board();
  const ids = [1, 2, 3].map((n) => lb.register(player(n)));
  assert.deepEqual(ids.map((id) => lb.recordBingo(id)), [1, 2, 3]);
});

test("a player's first bingo is recorded only once", () => {
  const lb = board();
  const id = lb.register(player(1));
  assert.equal(lb.recordBingo(id), 1);
  assert.equal(lb.recordBingo(id), null);
  assert.equal(lb.recordBingo(id), null);
});

test("the badge follows the bingo and never clears", () => {
  const lb = board();
  const id = lb.register(player(1, [], { nickname: "A" }));
  assert.equal(lb.snapshot(id).you!.badge, false);
  lb.recordBingo(id);
  assert.equal(lb.snapshot(id).you!.badge, true);
  lb.register(player(1, [], { nickname: "A", announced: false })); // unmarked everything
  assert.equal(lb.snapshot(id).you!.badge, true);
});

test("a replayed older cookie (before the bingo) cannot announce a second time", () => {
  const lb = board();
  const before = player(1, [0, 1, 2, 3]); // cookie from before the bingo: announced = false
  const id = lb.register(before);
  assert.equal(lb.recordBingo(id), 1);
  lb.register({ ...before, announced: true }); // the cookie after the bingo
  lb.register(before); // an attacker replays the old copy
  assert.equal(lb.recordBingo(lb.register(before)), null);
  assert.equal(lb.snapshot(id).you!.badge, true);
});

test("silent registration with an earlier bingo: badge, no placement, no announcement", () => {
  const lb = board();
  const id = lb.register(player(1, [0, 1, 2, 3, 4], { announced: true }));
  assert.equal(lb.snapshot(id).you!.badge, true);
  assert.equal(lb.recordBingo(id), null);
  // and it does not consume a placement: the next real first bingo is still #1
  const other = lb.register(player(2));
  assert.equal(lb.recordBingo(other), 1);
});

test("recording a bingo for an unknown player does nothing", () => {
  assert.equal(board().recordBingo("deadbeef0000"), null);
});

// ---------------------------------------------------------------- 1.4 cap and snapshot

test("the player list is capped and drops the least recently seen first", () => {
  const lb = board({ maxPlayers: 3 });
  lb.register(player(1, [], { nickname: "A" }));
  lb.register(player(2, [], { nickname: "B" }));
  lb.register(player(3, [], { nickname: "C" }));
  lb.register(player(1, [], { nickname: "A" })); // A seen again: B is now the oldest
  lb.register(player(4, [], { nickname: "D" }));
  assert.equal(lb.size, 3);
  assert.deepEqual(new Set(names(lb)), new Set(["A", "C", "D"]));
});

test("the 5001st player evicts the least recently seen with the default cap", () => {
  const lb = board();
  for (let n = 0; n < 5001; n++) {
    lb.register({ ...player(0), playerId: Uint8Array.from([n >> 8, n & 255, 0, 0, 0, 0]) });
  }
  assert.equal(lb.size, 5000);
});

/** Marked word cells 0..n-1 (n <= 12, so the pizza center is never touched). */
const range = (n: number) => Array.from({ length: n }, (_, i) => i);

test("the snapshot shows the top 10 and the total", () => {
  const lb = board();
  for (let n = 1; n <= 12; n++) lb.register(player(n, range(n)));
  const snap = lb.snapshot(null);
  assert.equal(snap.top.length, 10);
  assert.equal(snap.total, 12);
  assert.equal(snap.you, null);
  assert.deepEqual(snap.top.map((r) => r.score), [12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
});

test("the viewer inside the top 10 gets their rank", () => {
  const lb = board();
  const me = lb.register(player(1, [0, 1, 2, 3], { nickname: "Me" }));
  lb.register(player(2, [0], { nickname: "B" }));
  const snap = lb.snapshot(me);
  assert.deepEqual(snap.you, { id: me, name: "Me", score: 4, badge: false, rank: 1 });
});

test("a viewer outside the top 10 still gets their own rank and score", () => {
  const lb = board();
  for (let n = 1; n <= 11; n++) lb.register(player(n, range(n), { nickname: `P${n}` }));
  const me = lb.register(player(99, [], { nickname: "Last" }));
  const snap = lb.snapshot(me);
  assert.equal(snap.top.length, 10);
  assert.ok(!snap.top.some((r) => r.id === me));
  assert.equal(snap.you!.rank, 12);
  assert.equal(snap.you!.score, 0);
  assert.equal(snap.total, 12);
});

test("a viewer without a card, or an unknown id, gets no own row", () => {
  const lb = board();
  lb.register(player(1));
  assert.equal(lb.snapshot(null).you, null);
  assert.equal(lb.snapshot("0123456789ab").you, null);
});

test("one Ranking serves many viewers with the shared top and their own rows", () => {
  const lb = board();
  const a = lb.register(player(1, [0, 1, 2], { nickname: "A" }));
  const b = lb.register(player(2, [0], { nickname: "B" }));
  const ranking = lb.ranking();
  assert.equal(ranking.snapshot(a).you!.rank, 1);
  assert.equal(ranking.snapshot(b).you!.rank, 2);
  assert.equal(ranking.snapshot(a).top, ranking.snapshot(b).top, "same shared array, built once");
});
