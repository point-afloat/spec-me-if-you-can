import { randomInt } from "node:crypto";
import { WORDS } from "./words.ts";

/** A card has 25 cells (row-major, 0..24). Cell 12 is the free pizza center. */
export const CELLS = 25;
export const CENTER = 12;
export const WORD_CELLS = 24;
/** Bit i of a mark mask is cell i. The center bit is always set. */
export const FREE_MASK = 1 << CENTER;
export const FULL_MASK = (1 << CELLS) - 1;

function lineMask(cells: number[]): number {
  return cells.reduce((mask, cell) => mask | (1 << cell), 0);
}

/** The 12 winning lines: 5 rows, 5 columns, 2 diagonals. */
export const LINES: readonly number[] = (() => {
  const lines: number[] = [];
  for (let i = 0; i < 5; i++) {
    lines.push(lineMask([0, 1, 2, 3, 4].map((c) => i * 5 + c)));
    lines.push(lineMask([0, 1, 2, 3, 4].map((r) => r * 5 + i)));
  }
  lines.push(lineMask([0, 6, 12, 18, 24]));
  lines.push(lineMask([4, 8, 12, 16, 20]));
  return lines;
})();

/**
 * Generate 24 distinct word ids in cell order (the center cell is skipped).
 * Fisher-Yates partial shuffle over the whole word list.
 */
export function generateCard(
  wordCount: number = WORDS.length,
  randInt: (maxExclusive: number) => number = (n) => randomInt(n),
): number[] {
  if (wordCount < WORD_CELLS) {
    throw new RangeError(`need at least ${WORD_CELLS} words, got ${wordCount}`);
  }
  const pool = Array.from({ length: wordCount }, (_, i) => i);
  for (let i = 0; i < WORD_CELLS; i++) {
    const j = i + randInt(pool.length - i);
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, WORD_CELLS);
}

/** Word id shown in a cell, or null for the free center cell. */
export function wordIdAt(words: readonly number[], cell: number): number | null {
  assertCell(cell);
  if (cell === CENTER) return null;
  return words[cell < CENTER ? cell : cell - 1] ?? null;
}

export function isValidCell(cell: unknown): cell is number {
  return Number.isInteger(cell) && (cell as number) >= 0 && (cell as number) < CELLS;
}

function assertCell(cell: number): void {
  if (!isValidCell(cell)) throw new RangeError(`cell out of range: ${cell}`);
}

/** Toggle a word cell. The free center cell can never be unmarked. */
export function toggle(mask: number, cell: number): number {
  assertCell(cell);
  if (cell === CENTER) return mask | FREE_MASK;
  return (mask ^ (1 << cell)) | FREE_MASK;
}

export function isMarked(mask: number, cell: number): boolean {
  assertCell(cell);
  return (mask & (1 << cell)) !== 0;
}

/** A bingo is any complete row, column or diagonal (the pizza counts as marked). */
export function hasBingo(mask: number): boolean {
  const effective = mask | FREE_MASK;
  return LINES.some((line) => (effective & line) === line);
}

export function markedWordCount(mask: number): number {
  let count = 0;
  for (let cell = 0; cell < CELLS; cell++) {
    if (cell !== CENTER && (mask & (1 << cell)) !== 0) count++;
  }
  return count;
}
