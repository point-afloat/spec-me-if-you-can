import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { CELLS, FREE_MASK, WORD_CELLS, generateCard } from "./card.ts";
import { validateNickname } from "./nickname.ts";
import { WORDS } from "./words.ts";

/**
 * Player state, stored in a signed cookie.
 *
 * Payload layout, format version 1 (all numbers big-endian):
 *   1 byte    format version (1)
 *   24 bytes  word ids, in cell order, skipping the center cell
 *   4 bytes   mark mask, bit i = cell i (center bit always set)
 *   1 byte    flags: bit 0 = first bingo announced
 *   6 bytes   random anonymous player id
 *   1 byte    nickname length in UTF-8 bytes (0 = no nickname)
 *   n bytes   nickname, UTF-8
 *
 * Cookie value: base64url(payload) "." base64url(HMAC-SHA256(payload)).
 * Newer app versions MUST keep reading every earlier format version.
 */
export const FORMAT_VERSION = 1;
const HEADER_BYTES = 1 + WORD_CELLS + 4 + 1 + 6 + 1;
const FLAG_ANNOUNCED = 1;

export interface PlayerState {
  words: number[];
  mask: number;
  announced: boolean;
  playerId: Uint8Array;
  nickname: string;
}

export function newPlayerState(): PlayerState {
  return {
    words: generateCard(),
    mask: FREE_MASK,
    announced: false,
    playerId: Uint8Array.from(randomBytes(6)),
    nickname: "",
  };
}

export function encodePayload(state: PlayerState): Buffer {
  const nick = Buffer.from(state.nickname, "utf8");
  if (nick.length > 255) throw new RangeError("nickname too long");
  if (state.words.length !== WORD_CELLS) throw new RangeError("card must have 24 words");
  if (state.playerId.length !== 6) throw new RangeError("player id must be 6 bytes");
  const buf = Buffer.alloc(HEADER_BYTES + nick.length);
  let o = 0;
  buf[o++] = FORMAT_VERSION;
  for (const word of state.words) buf[o++] = word;
  buf.writeUInt32BE(state.mask >>> 0, o);
  o += 4;
  buf[o++] = state.announced ? FLAG_ANNOUNCED : 0;
  buf.set(state.playerId, o);
  o += 6;
  buf[o++] = nick.length;
  buf.set(nick, o);
  return buf;
}

/** Decode a payload. Returns null for anything that is not a valid, known version. */
export function decodePayload(buf: Buffer): PlayerState | null {
  if (buf.length < HEADER_BYTES) return null;
  let o = 0;
  const version = buf[o++];
  if (version !== 1) return null; // unknown (or newer) version: treated as invalid

  const words: number[] = [];
  for (let i = 0; i < WORD_CELLS; i++) words.push(buf[o++]!);
  if (new Set(words).size !== WORD_CELLS) return null;
  if (words.some((w) => w >= WORDS.length)) return null;

  const mask = buf.readUInt32BE(o);
  o += 4;
  if (mask >= 2 ** CELLS || (mask & FREE_MASK) === 0) return null;

  const flags = buf[o++]!;
  if ((flags & ~FLAG_ANNOUNCED) !== 0) return null;

  const playerId = Uint8Array.from(buf.subarray(o, o + 6));
  o += 6;

  const nickLength = buf[o++]!;
  if (buf.length !== HEADER_BYTES + nickLength) return null;
  let nickname = "";
  if (nickLength > 0) {
    try {
      nickname = new TextDecoder("utf-8", { fatal: true }).decode(buf.subarray(o, o + nickLength));
    } catch {
      return null;
    }
    if (validateNickname(nickname) !== nickname) return null;
  }

  return { words, mask, announced: (flags & FLAG_ANNOUNCED) !== 0, playerId, nickname };
}

function mac(payload: Buffer, secret: string): Buffer {
  return createHmac("sha256", secret).update(payload).digest();
}

export function sign(state: PlayerState, secret: string): string {
  const payload = encodePayload(state);
  return `${payload.toString("base64url")}.${mac(payload, secret).toString("base64url")}`;
}

/** Verify signature and decode. Returns null if missing, forged, malformed or unknown. */
export function verify(token: string | undefined, secret: string): PlayerState | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const payload = Buffer.from(parts[0]!, "base64url");
  const given = Buffer.from(parts[1]!, "base64url");
  const expected = mac(payload, secret);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  return decodePayload(payload);
}
