// In-memory Redis client for development
class InMemoryRedis {
  private store: Map<string, { value: string | number, expiresAt?: number }> = new Map();
  private expiryTimers: Map<string, NodeJS.Timeout> = new Map();

  async set(key: string, value: string | number, options?: { EX?: number }): Promise<void> {
    const expiresAt = options?.EX ? Date.now() + (options.EX * 1000) : undefined;

    // Clear existing expiry timer
    if (this.expiryTimers.has(key)) {
      clearTimeout(this.expiryTimers.get(key)!);
      this.expiryTimers.delete(key);
    }

    this.store.set(key, { value, expiresAt });

    if (expiresAt) {
      const timer = setTimeout(() => {
        this.store.delete(key);
        this.expiryTimers.delete(key);
      }, options!.EX! * 1000);
      this.expiryTimers.set(key, timer);
    }
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.value.toString();
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key);
    const newValue = current ? parseInt(current) + 1 : 1;
    const entry = this.store.get(key);

    if (entry) {
      entry.value = newValue;
    } else {
      this.store.set(key, { value: newValue });
    }

    return newValue;
  }

  async exists(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;

    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return 0;
    }

    return 1;
  }

  async del(key: string): Promise<number> {
    if (this.expiryTimers.has(key)) {
      clearTimeout(this.expiryTimers.get(key)!);
      this.expiryTimers.delete(key);
    }

    return this.store.delete(key) ? 1 : 0;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return -2;

    if (!entry.expiresAt) return -1;

    const remaining = Math.ceil((entry.expiresAt - Date.now()) / 1000);
    return remaining > 0 ? remaining : -2;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry) return 0;

    entry.expiresAt = Date.now() + (seconds * 1000);

    // Clear existing timer
    if (this.expiryTimers.has(key)) {
      clearTimeout(this.expiryTimers.get(key)!);
    }

    // Set new timer
    const timer = setTimeout(() => {
      this.store.delete(key);
      this.expiryTimers.delete(key);
    }, seconds * 1000);
    this.expiryTimers.set(key, timer);

    return 1;
  }

  multi() {
    const operations: Array<() => Promise<unknown>> = [];
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    return {
      incr(key: string) {
        operations.push(() => self.incr(key));
        return this;
      },
      expire(key: string, seconds: number) {
        operations.push(() => self.expire(key, seconds));
        return this;
      },
      async exec() {
        return await Promise.all(operations.map(op => op()));
      }
    };
  }

  async connect(): Promise<void> {
    // No-op for in-memory storage
  }
}

export const inMemoryRedis = new InMemoryRedis();
export default inMemoryRedis;