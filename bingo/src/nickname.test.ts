import { test } from "node:test";
import assert from "node:assert/strict";
import { displayName, fallbackLabel, validateNickname } from "./nickname.ts";

test("accepts and trims a valid nickname", () => {
  assert.equal(validateNickname("  Ada  "), "Ada");
  assert.equal(validateNickname("Grace Hopper"), "Grace Hopper");
});

test("accepts exactly 20 characters, rejects 21", () => {
  assert.equal(validateNickname("a".repeat(20)), "a".repeat(20));
  assert.equal(validateNickname("a".repeat(21)), null);
});

test("counts code points, not UTF-16 units", () => {
  assert.equal(validateNickname("🍕".repeat(20)), "🍕".repeat(20));
  assert.equal(validateNickname("🍕".repeat(21)), null);
});

test("rejects empty, whitespace-only and non-string input", () => {
  for (const bad of ["", "   ", undefined, null, 42, {}, []]) {
    assert.equal(validateNickname(bad), null);
  }
});

test("rejects control characters", () => {
  for (const bad of ["a\u0000b", "a\nb", "a\tb", "a\u001fb", "a b"]) {
    assert.equal(validateNickname(bad), null);
  }
});

test("allows duplicates (no uniqueness check)", () => {
  assert.equal(validateNickname("Ada"), validateNickname("Ada"));
});

test("markup is kept as text, not rejected", () => {
  assert.equal(validateNickname("<b>x</b>"), "<b>x</b>");
});

test("fallback label is stable and derived from the id", () => {
  const id = Uint8Array.from([0x4f, 0x2a, 1, 2, 3, 4]);
  assert.equal(fallbackLabel(id), "Player 4F2A");
  assert.equal(fallbackLabel(id), fallbackLabel(id));
  assert.equal(fallbackLabel(Uint8Array.from([0, 1, 0, 0, 0, 0])), "Player 0001");
});

test("display name prefers the nickname", () => {
  const id = Uint8Array.from([0x4f, 0x2a, 1, 2, 3, 4]);
  assert.equal(displayName("", id), "Player 4F2A");
  assert.equal(displayName("Ada", id), "Ada");
});
