const DEFAULT_GROUP = "";

export class Semaphore {
  private active = 0;
  private readonly waiting = new Map<string, (() => void)[]>();

  constructor(private readonly limit: number) {}

  async run<T>(task: () => Promise<T>, group = DEFAULT_GROUP): Promise<T> {
    if (this.active < this.limit) {
      this.active += 1;
    } else {
      await new Promise<void>((resolve) => {
        const queue = this.waiting.get(group) ?? [];
        queue.push(resolve);
        this.waiting.set(group, queue);
      });
    }

    try {
      return await task();
    } finally {
      this.release();
    }
  }

  // A freed slot passes straight to the group with the fewest waiters, so a short document is not stuck behind every section of a long one.
  private release(): void {
    let shortest: [string, (() => void)[]] | null = null;
    for (const entry of this.waiting) {
      if (!shortest || entry[1].length < shortest[1].length) shortest = entry;
    }
    if (!shortest) {
      this.active -= 1;
      return;
    }

    const [group, queue] = shortest;
    const next = queue.shift()!;
    if (queue.length === 0) this.waiting.delete(group);
    next();
  }
}
