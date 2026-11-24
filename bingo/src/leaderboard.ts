import { createHmac } from "node:crypto";
import { markedWordCount } from "./card.ts";
import type { PlayerState } from "./cookie.ts";
import { displayName } from "./nickname.ts";

/**
 * In-memory standings of the current server run.
 *
 * Nothing here is persistent: after a restart the store is empty and is rebuilt
 * silently as players' pages reconnect with their signed cookie (see register()).
 * Every score and name comes from a verified cookie state, never from the client.
 */

export const DEFAULT_MAX_PLAYERS = 5000;
export const DEFAULT_TOP_SIZE = 10;

/**
 * The id other clients see for a player: the first 12 hex characters of an HMAC of
 * the player's cookie id. Lets pages highlight their own row without exposing the
 * raw id stored in the cookie.
 */
export function publicId(playerId: Uint8Array, secret: string): string {
  const raw = Buffer.from(playerId).toString("hex");
  return createHmac("sha256", secret).update(`pid:${raw}`).digest("hex").slice(0, 12);
}

interface Entry {
  id: string;
  name: string;
  score: number;
  /** Has had a bingo (badge). Monotonic: set from the cookie or by recordBingo, never cleared. */
  announced: boolean;
  /** Placement of the first bingo announced in this server run, or null. */
  place: number | null;
  /** Logical clock value when the score last changed: lower means reached earlier. */
  reachedAt: number;
}

export interface StandingsRow {
  id: string;
  name: string;
  score: number;
  badge: boolean;
}

export interface YouRow extends StandingsRow {
  rank: number;
}

export interface Snapshot {
  top: StandingsRow[];
  total: number;
  you: YouRow | null;
}

function toRow(entry: Entry): StandingsRow {
  return { id: entry.id, name: entry.name, score: entry.score, badge: entry.announced };
}

/** One sorted view of the standings, built once and shared by every viewer of a push. */
export class Ranking {
  readonly total: number;
  private readonly sorted: Entry[];
  private readonly ranks = new Map<string, number>();
  private readonly top: StandingsRow[];

  constructor(entries: Iterable<Entry>, topSize: number) {
    this.sorted = [...entries].sort(
      (a, b) => b.score - a.score || a.reachedAt - b.reachedAt || (a.id < b.id ? -1 : 1),
    );
    this.sorted.forEach((entry, i) => this.ranks.set(entry.id, i + 1));
    this.total = this.sorted.length;
    this.top = this.sorted.slice(0, topSize).map(toRow);
  }

  /** The shared top entries plus the viewer's own entry (null for viewers without a card). */
  snapshot(viewerId: string | null): Snapshot {
    const rank = viewerId === null ? undefined : this.ranks.get(viewerId);
    const you = rank === undefined ? null : { ...toRow(this.sorted[rank - 1]!), rank };
    return { top: this.top, total: this.total, you };
  }
}

export interface LeaderboardOptions {
  secret: string;
  maxPlayers?: number;
  topSize?: number;
}

export class Leaderboard {
  private readonly secret: string;
  private readonly maxPlayers: number;
  private readonly topSize: number;
  /** Insertion order = least recently seen first (entries are re-inserted on every register). */
  private readonly entries = new Map<string, Entry>();
  private clock = 0;
  private placeCounter = 0;
  private changes = 0;

  constructor(options: LeaderboardOptions) {
    this.secret = options.secret;
    this.maxPlayers = options.maxPlayers ?? DEFAULT_MAX_PLAYERS;
    this.topSize = options.topSize ?? DEFAULT_TOP_SIZE;
  }

  get size(): number {
    return this.entries.size;
  }

  /** Increases whenever anything visible in the standings changes (not on a plain refresh). */
  get version(): number {
    return this.changes;
  }

  idOf(state: PlayerState): string {
    return publicId(state.playerId, this.secret);
  }

  /**
   * Register or refresh a player from verified cookie state. Silent: it never announces
   * anything. The bingo flag only ever turns on, so replaying an older cookie copy cannot
   * take a badge away. Returns the player's public id.
   */
  register(state: PlayerState): string {
    const id = this.idOf(state);
    const score = markedWordCount(state.mask);
    const name = displayName(state.nickname, state.playerId);
    const existing = this.entries.get(id);

    let entry: Entry;
    if (existing) {
      this.entries.delete(id); // re-inserted below: moves it to the most recently seen end
      entry = existing;
      if (entry.name !== name) {
        entry.name = name;
        this.changes++;
      }
      if (!entry.announced && state.announced) {
        entry.announced = true;
        this.changes++;
      }
      if (entry.score !== score) {
        entry.score = score;
        entry.reachedAt = ++this.clock;
        this.changes++;
      }
    } else {
      entry = { id, name, score, announced: state.announced, place: null, reachedAt: ++this.clock };
      this.changes++;
    }
    this.entries.set(id, entry);

    while (this.entries.size > this.maxPlayers) {
      const oldest = this.entries.keys().next().value as string;
      this.entries.delete(oldest);
      this.changes++;
    }
    return id;
  }

  /**
   * Record a player's first bingo. Returns the placement (1 for the first bingo of this
   * server run, 2 for the next, ...) or null if this player already has one, was registered
   * with one, or is unknown. Call register() with the state from before the mark first.
   */
  recordBingo(id: string): number | null {
    const entry = this.entries.get(id);
    if (!entry || entry.announced) return null;
    entry.announced = true;
    entry.place = ++this.placeCounter;
    this.changes++;
    return entry.place;
  }

  ranking(): Ranking {
    return new Ranking(this.entries.values(), this.topSize);
  }

  /** Convenience for a single viewer; use ranking() when serving many viewers at once. */
  snapshot(viewerId: string | null): Snapshot {
    return this.ranking().snapshot(viewerId);
  }
}
