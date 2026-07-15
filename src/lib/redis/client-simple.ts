import type { RedisClientType } from 'redis';
import inMemoryRedis from './in-memory';

const REDIS_URL = process.env.REDIS_URL;

// Use in-memory Redis for development
let useInMemory = !REDIS_URL;

if (!useInMemory) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = require('redis');

    // Global Redis client cache
    let redisClient: RedisClientType | null = null;

    async function getRedisClient(): Promise<RedisClientType> {
      if (redisClient) {
        return redisClient;
      }

      const client = createClient({
        url: REDIS_URL
      });

      client.on('error', (err: Error) => {
        console.error('Redis Client Error:', err);
        useInMemory = true; // Fallback to in-memory on error
      });

      await client.connect();
      redisClient = client as RedisClientType;
      return redisClient;
    }

    module.exports = { getRedisClient };
  } catch {
    console.warn('Redis client not available, using in-memory storage');
    useInMemory = true;
  }
}

if (useInMemory) {
  async function getRedisClient() {
    return inMemoryRedis;
  }

  module.exports = { getRedisClient };
}