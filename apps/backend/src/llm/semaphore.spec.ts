import { Semaphore } from "./semaphore.js";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("Semaphore", () => {
  it("never runs more tasks than its limit, even when a caller arrives during a hand-off", async () => {
    const semaphore = new Semaphore(1);
    let running = 0;
    let peak = 0;
    const gate = deferred();
    const task = async () => {
      running += 1;
      peak = Math.max(peak, running);
      await gate.promise;
      running -= 1;
    };

    const first = semaphore.run(task);
    const second = semaphore.run(task);
    await flush();
    gate.resolve();
    const late = semaphore.run(task);
    await Promise.all([first, second, late]);

    expect(peak).toBe(1);
  });

  it("gives a freed slot to the group with the fewest waiters", async () => {
    const semaphore = new Semaphore(1);
    const order: string[] = [];
    const blocker = deferred();

    const running = semaphore.run(() => blocker.promise, "long");
    const queued = [
      ...["long-1", "long-2", "long-3"].map((name) =>
        semaphore.run(async () => void order.push(name), "long"),
      ),
      ...["short-1", "short-2"].map((name) =>
        semaphore.run(async () => void order.push(name), "short"),
      ),
    ];
    await flush();
    blocker.resolve();
    await Promise.all([running, ...queued]);

    expect(order).toEqual(["short-1", "short-2", "long-1", "long-2", "long-3"]);
  });
});
