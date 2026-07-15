import { createClient, RedisClientType } from 'redis';
import inMemoryRedis from './in-memory';

// Global Redis client cache
let redisClient: RedisClientType | any = null;
let useInMemory = false;

export async function getRedisClient(): Promise<any> {
  if (useInMemory) {
    return inMemoryRedis;
  }
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  // Create Redis client
  const client = createClient({
    url: redisUrl,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 5) {
          console.warn('Redis reconnection attempts exceeded, using in-memory fallback');
          useInMemory = true;
          return false;
        }
        return Math.min(retries * 100, 5000); // Exponential backoff
      }
    }
  });

  client.on('error', (err) => {
    console.error('Redis Client Error:', err);
    useInMemory = true;
  });

  client.on('connect', () => {
    console.log('✅ Redis connected successfully');
  });

  try {
    await client.connect();
    redisClient = client as RedisClientType;
    return redisClient;
  } catch (error) {
    console.error('❌ Failed to connect to Redis, using in-memory fallback:', error);
    useInMemory = true;
    return inMemoryRedis;
  }
}

export async function setFileExpiry(fileId: string, expiresAt: Date): Promise<void> {
  try {
    const client = await getRedisClient();
    const ttl = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

    if (ttl > 0) {
      await client.set(`file:${fileId}:expires`, '1', {
        EX: ttl
      });
    }
  } catch (error) {
    console.warn('Redis error, using in-memory fallback:', error);
  }
}

export async function checkFileExpiry(fileId: string): Promise<boolean> {
  try {
    const client = await getRedisClient();
    const exists = await client.exists(`file:${fileId}:expires`);
    return exists === 0; // If key doesn't exist, file has expired
  } catch (error) {
    console.warn('Redis error, using in-memory fallback:', error);
    return false;
  }
}

export async function incrementDownloadCount(fileId: string): Promise<number> {
  try {
    const client = await getRedisClient();
    const count = await client.incr(`file:${fileId}:downloads`);
    return count;
  } catch (error) {
    console.warn('Redis error, using in-memory fallback:', error);
    return 1; // Default to 1 if Redis fails
  }
}

export async function getDownloadCount(fileId: string): Promise<number> {
  try {
    const client = await getRedisClient();
    const count = await client.get(`file:${fileId}:downloads`);
    return count ? parseInt(count) : 0;
  } catch (error) {
    console.warn('Redis error, using in-memory fallback:', error);
    return 0; // Default to 0 if Redis fails
  }
}

export async function setDownloadLimit(fileId: string, limit: number): Promise<void> {
  try {
    const client = await getRedisClient();
    await client.set(`file:${fileId}:limit`, limit.toString());
  } catch (error) {
    console.warn('Redis error, using in-memory fallback:', error);
  }
}

export async function getDownloadLimit(fileId: string): Promise<number> {
  try {
    const client = await getRedisClient();
    const limit = await client.get(`file:${fileId}:limit`);
    return limit ? parseInt(limit) : 1;
  } catch (error) {
    console.warn('Redis error, using in-memory fallback:', error);
    return 1; // Default to 1 if Redis fails
  }
}

export async function cleanupFileKeys(fileId: string): Promise<void> {
  try {
    const client = await getRedisClient();
    await client.del(`file:${fileId}:expires`);
    await client.del(`file:${fileId}:downloads`);
    await client.del(`file:${fileId}:limit`);
  } catch (error) {
    console.warn('Redis error, using in-memory fallback:', error);
  }
}

export default getRedisClient;