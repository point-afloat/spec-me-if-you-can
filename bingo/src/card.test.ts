import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CELLS,
  CENTER,
  FREE_MASK,
  LINES,
  generateCard,
  hasBingo,
  isMarked,
  markedWordCount,
  toggle,
  wordIdAt,
} from "./card.ts";
import { WORDS } from "./words.ts";

function maskOf(...cells: number[]): number {
  return cells.reduce((m, c) => m | (1 << c), FREE_MASK);
}

test("generates 24 distinct valid word ids", () => {
  for (let i = 0; i < 200; i++) {
    const words = generateCard();
    assert.equal(words.length, 24);
    assert.equal(new Set(words).size, 24);
    assert.ok(words.every((w) => Number.isInteger(w) && w >= 0 && w < WORDS.length));
  }
});

test("cards differ between generations", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 20; i++) seen.add(generateCard().join(","));
  assert.ok(seen.size > 1);
});

test("appended words become eligible", () => {
  // A list that grew to 60 words: some card must eventually use an id >= 48.
  let usedNew = false;
  for (let i = 0; i < 200 && !usedNew; i++) {
    usedNew = generateCard(60).some((w) => w >= 48);
  }
  assert.ok(usedNew);
});

test("rejects a word list that is too small", () => {
  assert.throws(() => generateCard(10), RangeError);
});

test("center cell is free and word cells map around it", () => {
  const words = Array.from({ length: 24 }, (_, i) => i);
  assert.equal(wordIdAt(words, CENTER), null);
  assert.equal(wordIdAt(words, 0), 0);
  assert.equal(wordIdAt(words, 11), 11);
  assert.equal(wordIdAt(words, 13), 12);
  assert.equal(wordIdAt(words, 24), 23);
  const shown = Array.from({ length: CELLS }, (_, c) => wordIdAt(words, c)).filter((w) => w !== null);
  assert.deepEqual(shown, words);
});

test("mark and unmark a word", () => {
  let mask = FREE_MASK;
  mask = toggle(mask, 7);
  assert.ok(isMarked(mask, 7));
  mask = toggle(mask, 7);
  assert.ok(!isMarked(mask, 7));
});

test("clicking the center changes nothing", () => {
  assert.equal(toggle(FREE_MASK, CENTER), FREE_MASK);
  assert.equal(toggle(maskOf(3, 4), CENTER), maskOf(3, 4));
});

test("out-of-range cells are rejected", () => {
  for (const cell of [-1, 25, 1.5, Number.NaN]) {
    assert.throws(() => toggle(FREE_MASK, cell), RangeError);
  }
});

test("a fresh card is not a bingo", () => {
  assert.equal(hasBingo(FREE_MASK), false);
});

test("row bingo", () => {
  assert.ok(hasBingo(maskOf(0, 1, 2, 3, 4)));
  assert.ok(hasBingo(maskOf(20, 21, 22, 23, 24)));
});

test("column bingo", () => {
  assert.ok(hasBingo(maskOf(0, 5, 10, 15, 20)));
  assert.ok(hasBingo(maskOf(4, 9, 14, 19, 24)));
});

test("diagonals need only four words because of the pizza", () => {
  assert.ok(hasBingo(maskOf(0, 6, 18, 24)));
  assert.ok(hasBingo(maskOf(4, 8, 16, 20)));
});

test("middle row and column need four words", () => {
  assert.ok(hasBingo(maskOf(10, 11, 13, 14)));
  assert.ok(hasBingo(maskOf(2, 7, 17, 22)));
});

test("incomplete lines are not a bingo", () => {
  assert.equal(hasBingo(maskOf(0, 1, 2, 3)), false);
  assert.equal(hasBingo(maskOf(0, 6, 18)), false);
});

test("there are 12 distinct lines", () => {
  assert.equal(LINES.length, 12);
  assert.equal(new Set(LINES).size, 12);
});

test("marked word count excludes the pizza", () => {
  assert.equal(markedWordCount(FREE_MASK), 0);
  assert.equal(markedWordCount(maskOf(1, 2, 3)), 3);
});
