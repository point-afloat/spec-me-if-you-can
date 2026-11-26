import { test } from "node:test";
import assert from "node:assert/strict";
import { Leaderboard, publicId } from "./leaderboard.ts";

const ID = Uint8Array.from([1, 2, 3, 4, 5, 6]);

test("public id is stable, per player, per secret and hides the raw id", () => {
  const secret = "test-secret-with-enough-length";
  const a = publicId(secret, ID);
  assert.match(a, /^[0-9a-f]{12}$/);
  assert.equal(a, publicId(secret, ID));
  assert.notEqual(a, publicId(secret, Uint8Array.from([1, 2, 3, 4, 5, 7])));
  assert.notEqual(a, publicId("another-secret-with-length", ID));
  assert.doesNotMatch(a, /010203040506/);
});

test("ranks by score, then by who reached it first, then id", () => {
  const board = new Leaderboard();
  board.register("a", "A", 3, false);
  board.register("b", "B", 5, false);
  board.register("c", "C", 5, false);
  board.register("a", "A", 5, false); // a reaches 5 last
  const order = board.ranking().rows.map((r) => r.id);
  assert.deepEqual(order, ["b", "c", "a"]);
  assert.deepEqual(board.ranking().rows.map((r) => r.rank), [1, 2, 3]);
});

test("refreshing without a score change keeps the tie-break position", () => {
  const board = new Leaderboard();
  board.register("a", "A", 2, false);
  board.register("b", "B", 2, false);
  board.register("a", "A", 2, false);
  assert.deepEqual(board.ranking().rows.map((r) => r.id), ["a", "b"]);
});

test("a rename updates the row and a score drop re-ranks", () => {
  const board = new Leaderboard();
  board.register("a", "A", 4, false);
  board.register("b", "B", 3, false);
  assert.equal(board.register("a", "Ada", 4, false), true);
  assert.equal(board.ranking().byId.get("a")?.name, "Ada");
  board.register("a", "Ada", 2, false); // unmarked two words
  assert.deepEqual(board.ranking().rows.map((r) => r.id), ["b", "a"]);
});

test("registering the same state again reports no change", () => {
  const board = new Leaderboard();
  board.register("a", "A", 1, false);
  assert.equal(board.register("a", "A", 1, false), false);
});

test("first bingo: placement once per player, in order, never cleared", () => {
  const board = new Leaderboard();
  board.register("a", "A", 4, false);
  board.register("b", "B", 4, false);
  assert.equal(board.recordBingo("a"), 1);
  assert.equal(board.recordBingo("b"), 2);
  assert.equal(board.recordBingo("a"), null);
  // a replayed older cookie (no bingo yet) must not reset the flag
  board.register("a", "A", 3, false);
  assert.equal(board.recordBingo("a"), null);
  assert.equal(board.ranking().byId.get("a")?.badge, true);
});

test("silent registration with a bingo gives the badge but no placement", () => {
  const board = new Leaderboard();
  board.register("a", "A", 6, true);
  assert.equal(board.ranking().byId.get("a")?.badge, true);
  assert.equal(board.recordBingo("a"), null);
  board.register("b", "B", 4, false);
  assert.equal(board.recordBingo("b"), 1);
});

test("an unknown player has no bingo to record", () => {
  assert.equal(new Leaderboard().recordBingo("nobody"), null);
});

test("evicts the least recently seen player over the cap", () => {
  const board = new Leaderboard(3);
  board.register("a", "A", 1, false);
  board.register("b", "B", 1, false);
  board.register("c", "C", 1, false);
  board.register("a", "A", 1, false); // a is fresh again, b is now the oldest
  board.register("d", "D", 1, false);
  const ids = board.ranking().rows.map((r) => r.id).sort();
  assert.deepEqual(ids, ["a", "c", "d"]);
  assert.equal(board.size, 3);
});

test("snapshot: top 10, the viewer outside the top 10, a viewer without a card", () => {
  const board = new Leaderboard();
  for (let i = 0; i < 12; i++) board.register(`p${i}`, `P${i}`, 20 - i, false);
  const inside = board.snapshot("p0");
  assert.equal(inside.top.length, 10);
  assert.equal(inside.total, 12);
  assert.equal(inside.you?.rank, 1);
  const outside = board.snapshot("p11");
  assert.equal(outside.top.length, 10);
  assert.equal(outside.you?.rank, 12);
  assert.equal(outside.you?.score, 9);
  const none = board.snapshot(null);
  assert.equal(none.you, null);
  assert.equal(none.total, 12);
  assert.equal(board.snapshot("unknown").you, null);
});
