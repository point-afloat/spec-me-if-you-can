export const NICKNAME_MAX_LENGTH = 20;

// Control characters, plus the Unicode line and paragraph separators.
const FORBIDDEN = /[\p{Cc}\p{Zl}\p{Zp}]/u;

/**
 * Validate a nickname. Returns the trimmed name, or null if it is not acceptable:
 * not a string, empty after trimming, longer than 20 characters (counted as
 * code points) or containing control characters.
 */
export function validateNickname(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.trim();
  if (name.length === 0) return null;
  if ([...name].length > NICKNAME_MAX_LENGTH) return null;
  if (FORBIDDEN.test(name)) return null;
  return name;
}

/** Anonymous label for players without a nickname, e.g. "Player 4F2A". */
export function fallbackLabel(playerId: Uint8Array): string {
  const hex = [playerId[0] ?? 0, playerId[1] ?? 0]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
  return `Player ${hex}`;
}

/** The name to display for a player: the nickname, or the anonymous label. */
export function displayName(nickname: string, playerId: Uint8Array): string {
  return nickname === "" ? fallbackLabel(playerId) : nickname;
}
