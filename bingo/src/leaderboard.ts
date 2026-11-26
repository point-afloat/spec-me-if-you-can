import { createHmac } from "node:crypto";

export const TOP_N = 10;
export const MAX_PLAYERS = 5000;

/**
 * The id other clients see for a player: the first 12 hex characters of an HMAC of the
 * cookie's player id. It lets a page find its own row without exposing the raw id.
 */
export function publicId(secret: string, playerId: Uint8Array): string {
  return createHmac("sha256", secret)
    .update("pid:")
    .update(playerId)
    .digest("hex")
    .slice(0, 12);
}

interface Entry {
  id: string;
  name: string;
  score: number;
  /** Has had a bingo: shown as a badge. Monotonic, never cleared. */
  announced: boolean;
  /** Order of the announced first bingo; null if registered silently with a bingo. */
  place: number | null;
  /** Logical time of the last score change; earlier ranks higher on equal scores. */
  reachedAt: number;
  lastSeen: number;
}

export interface StandingRow {
  rank: number;
  id: string;
  name: string;
  score: number;
  badge: boolean;
}

export interface Snapshot {
  top: StandingRow[];
  you: StandingRow | null;
  total: number;
}

export interface Ranking {
  rows: StandingRow[];
  byId: Map<string, StandingRow>;
}

/** In-memory standings. Rebuilt from players' cookies after any restart. */
export class Leaderboard {
  private entries = new Map<string, Entry>();
  private clock = 0;
  private placeCounter = 0;
  private maxPlayers: number;

  constructor(maxPlayers: number = MAX_PLAYERS) {
    this.maxPlayers = maxPlayers;
  }

  get size(): number {
    return this.entries.size;
  }

  /**
   * Register or refresh a player from verified cookie state. Silent: never announces.
   * A bingo flag from the cookie gives the badge but no placement.
   * Returns true if anything visible in the standings changed.
   */
  register(id: string, name: string, score: number, hadBingo: boolean): boolean {
    const now = ++this.clock;
    const existing = this.entries.get(id);
    if (!existing) {
      this.entries.set(id, {
        id,
        name,
        score,
        announced: hadBingo,
        place: null,
        reachedAt: now,
        lastSeen: now,
      });
      this.evict();
      return true;
    }
    existing.lastSeen = now;
    let changed = false;
    if (existing.name !== name) {
      existing.name = name;
      changed = true;
    }
    if (existing.score !== score) {
      existing.score = score;
      existing.reachedAt = now;
      changed = true;
    }
    if (hadBingo && !existing.announced) {
      existing.announced = true;
      changed = true;
    }
    return changed;
  }

  /**
   * Record a player's first bingo. Returns the placement once per player, or null if
   * the player is unknown or was already announced (the flag never clears, so an older
   * cookie copy cannot trigger a second announcement).
   */
  recordBingo(id: string): number | null {
    const entry = this.entries.get(id);
    if (!entry || entry.announced) return null;
    entry.announced = true;
    entry.place = ++this.placeCounter;
    return entry.place;
  }

  nameOf(id: string): string | undefined {
    return this.entries.get(id)?.name;
  }

  /** Full ranking: score descending, then earlier reachedAt, then id. */
  ranking(): Ranking {
    const sorted = [...this.entries.values()].sort(
      (a, b) => b.score - a.score || a.reachedAt - b.reachedAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    const rows = sorted.map((e, i) => ({
      rank: i + 1,
      id: e.id,
      name: e.name,
      score: e.score,
      badge: e.announced,
    }));
    return { rows, byId: new Map(rows.map((r) => [r.id, r])) };
  }

  /** Snapshot for one viewer, built from a ranking computed once per push. */
  snapshot(viewerId: string | null, ranking: Ranking = this.ranking()): Snapshot {
    return {
      top: ranking.rows.slice(0, TOP_N),
      you: viewerId ? (ranking.byId.get(viewerId) ?? null) : null,
      total: ranking.rows.length,
    };
  }

  private evict(): void {
    while (this.entries.size > this.maxPlayers) {
      let oldest: Entry | undefined;
      for (const e of this.entries.values()) if (!oldest || e.lastSeen < oldest.lastSeen) oldest = e;
      if (!oldest) return;
      this.entries.delete(oldest.id);
    }
  }
}
