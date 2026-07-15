import { NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis/client';

// Rate limiting configuration
export const RATE_LIMITS = {
  upload: {
    windowMs: 60 * 1000, // 1 minute
    max: parseInt(process.env.UPLOAD_RATE_LIMIT || '10'), // requests per window
  },
  download: {
    windowMs: 60 * 1000, // 1 minute
    max: parseInt(process.env.DOWNLOAD_RATE_LIMIT || '30'), // requests per window
  },
};

export async function rateLimit(
  identifier: string,
  type: 'upload' | 'download'
): Promise<{ success: boolean, limit: number, remaining: number, reset: number }> {
  const client = await getRedisClient();
  const config = RATE_LIMITS[type];
  const key = `rate_limit:${type}:${identifier}`;

  // Get current count
  const current = await client.get(key);
  const count = current ? parseInt(current) : 0;

  // Check if limit exceeded
  if (count >= config.max) {
    const ttl = await client.ttl(key);
    return {
      success: false,
      limit: config.max,
      remaining: 0,
      reset: Date.now() + (ttl * 1000),
    };
  }

  // Increment count
  const multi = client.multi();
  multi.incr(key);
  if (count === 0) {
    multi.expire(key, Math.ceil(config.windowMs / 1000));
  }
  await multi.exec();

  // Get updated count and TTL
  const newCount = count + 1;
  const ttl = await client.ttl(key);

  return {
    success: true,
    limit: config.max,
    remaining: config.max - newCount,
    reset: Date.now() + (ttl * 1000),
  };
}

export function rateLimitResponse(
  result: { success: boolean, limit: number, remaining: number, reset: number }
) {
  if (!result.success) {
    return NextResponse.json(
      {
        error: 'Too many requests',
        limit: result.limit,
        remaining: result.remaining,
        reset: new Date(result.reset).toISOString()
      },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': result.limit.toString(),
          'X-RateLimit-Remaining': result.remaining.toString(),
          'X-RateLimit-Reset': Math.ceil(result.reset / 1000).toString(),
        }
      }
    );
  }

  return null;
}