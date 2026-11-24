import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { FREE_MASK, toggle } from "./card.ts";
import {
  decodePayload,
  encodePayload,
  newPlayerState,
  sign,
  verify,
  type PlayerState,
} from "./cookie.ts";

const SECRET = "test-secret-with-enough-length";

function sample(): PlayerState {
  return {
    words: Array.from({ length: 24 }, (_, i) => i),
    mask: toggle(toggle(FREE_MASK, 0), 5),
    announced: true,
    playerId: Uint8Array.from([1, 2, 3, 4, 5, 6]),
    nickname: "Ada 🍕",
  };
}

test("payload round trip keeps every field", () => {
  const state = sample();
  assert.deepEqual(decodePayload(encodePayload(state)), state);
});

test("new player state is valid and round-trips", () => {
  const state = newPlayerState();
  assert.equal(state.mask, FREE_MASK);
  assert.equal(state.nickname, "");
  assert.equal(state.announced, false);
  assert.deepEqual(decodePayload(encodePayload(state)), state);
});

test("cookie stays far below the 4 KB limit, even with the longest nickname", () => {
  const longest = { ...sample(), nickname: "🍕".repeat(20) };
  assert.ok(sign(longest, SECRET).length < 400);
  assert.ok(sign(newPlayerState(), SECRET).length < 120);
});

test("signed cookie verifies and restores the state", () => {
  const state = sample();
  assert.deepEqual(verify(sign(state, SECRET), SECRET), state);
});

test("player id is stable across re-signing", () => {
  const state = sample();
  const next = verify(sign({ ...state, mask: toggle(state.mask, 9) }, SECRET), SECRET);
  assert.deepEqual(next?.playerId, state.playerId);
});

test("tampered payload is rejected", () => {
  const token = sign(sample(), SECRET);
  const [payload, signature] = token.split(".") as [string, string];
  const forged = encodePayload({ ...sample(), mask: 0x1ffffff });
  assert.equal(verify(`${forged.toString("base64url")}.${signature}`, SECRET), null);
  assert.equal(verify(`${payload}.${"A".repeat(signature.length)}`, SECRET), null);
});

test("cookie signed with another secret is rejected", () => {
  assert.equal(verify(sign(sample(), "another-secret-entirely"), SECRET), null);
});

test("missing, empty and malformed cookies are rejected", () => {
  for (const bad of [undefined, "", "abc", "a.b.c", ".", "!!!.???"]) {
    assert.equal(verify(bad, SECRET), null);
  }
});

test("unknown newer version is treated as invalid, even if correctly signed", () => {
  const payload = encodePayload(sample());
  payload[0] = 2;
  const token = `${payload.toString("base64url")}.${createHmac("sha256", SECRET).update(payload).digest().toString("base64url")}`;
  assert.equal(verify(token, SECRET), null);
});

test("structurally invalid payloads are rejected", () => {
  const good = encodePayload(sample());

  const duplicate = Buffer.from(good);
  duplicate[2] = duplicate[1]!; // two cells with the same word
  assert.equal(decodePayload(duplicate), null);

  const outOfList = Buffer.from(good);
  outOfList[1] = 255; // not in the word list
  assert.equal(decodePayload(outOfList), null);

  const noCenter = Buffer.from(good);
  noCenter.writeUInt32BE(1, 25); // center bit cleared
  assert.equal(decodePayload(noCenter), null);

  assert.equal(decodePayload(good.subarray(0, good.length - 1)), null);
  assert.equal(decodePayload(Buffer.concat([good, Buffer.from([0])])), null);
});

// Format version 1, pinned as bytes: words 0..23, mask 0x1001, not announced,
// player id 01..06, nickname "Ada". Every later app version must keep reading this.
const V1_FIXTURE =
  "01" +
  "000102030405060708090a0b0c0d0e0f1011121314151617" +
  "00001001" +
  "00" +
  "010203040506" +
  "03" +
  "416461";

test("a format version 1 cookie is still accepted", () => {
  const state = decodePayload(Buffer.from(V1_FIXTURE, "hex"));
  assert.deepEqual(state, {
    words: Array.from({ length: 24 }, (_, i) => i),
    mask: 0x1001,
    announced: false,
    playerId: Uint8Array.from([1, 2, 3, 4, 5, 6]),
    nickname: "Ada",
  });
  assert.equal(encodePayload(state!).toString("hex"), V1_FIXTURE);
});

test("a cookie made before the word list grew decodes to the same words", () => {
  // Ids are positions, so appending words cannot change what an old card shows.
  const state = decodePayload(Buffer.from(V1_FIXTURE, "hex"))!;
  assert.deepEqual(state.words, Array.from({ length: 24 }, (_, i) => i));
});
