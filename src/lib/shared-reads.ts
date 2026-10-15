/**
 * One set of reads, shared by every caller that asks for the same key within
 * a moment of each other, on this instance.
 *
 * The live screen and the Control Center's mirror of it each poll every few
 * seconds, and on the GitHub driver each poll is seven or eight reads that
 * count against GitHub's per-minute limit even when nothing changed. Polls
 * landing within `forMs` of each other share the first one's reads instead.
 *
 * `generation` is how a write on this instance makes the next caller read
 * afresh at once: the caller passes a number that every write bumps, and a
 * shared set taken under another number is never handed out. A read that
 * fails is not kept, so the next caller tries again rather than sharing the
 * failure.
 *
 * No Next or store import, so the sharing rules are tested directly.
 */
export class SharedReads<T> {
  private readonly entries = new Map<string, { at: number; generation: number; value: Promise<T> }>();
  /** How long a set of reads is shared, from when it started. */
  readonly forMs: number;

  // Written out rather than as a constructor parameter property: the test
  // runner strips types without transforming, and that syntax needs a compile.
  constructor(forMs: number) {
    this.forMs = forMs;
  }

  /** The shared reads for this key, or `read()` started now when there are none fresh enough to share. */
  get(key: string, generation: number, read: () => Promise<T>, now: number = Date.now()): Promise<T> {
    const known = this.entries.get(key);
    // A clock that went backwards counts as stale too, so nothing is shared for longer than forMs.
    if (known && known.generation === generation && now >= known.at && now - known.at < this.forMs) return known.value;
    const entry = { at: now, generation, value: read() };
    this.entries.set(key, entry);
    entry.value.catch(() => { if (this.entries.get(key) === entry) this.entries.delete(key); });
    return entry.value;
  }
}
