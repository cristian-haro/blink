// Outbound Redis Storage Adapter for Blink
const Redis = require('ioredis');

class RedisStorageAdapter {
  constructor(redisUrl = process.env.REDIS_URL || 'redis://localhost:6379') {
    this.redisUrl = redisUrl;
    this.lastWarned = 0;
    this.client = new Redis(this.redisUrl, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        return Math.min(times * 1000, 5000);
      }
    });

    this.client.on('connect', () => {
      console.log('[Blink] Connected to Redis adapter successfully');
    });

    this.client.on('error', (err) => {
      if (err.code === 'ECONNREFUSED') {
        const now = Date.now();
        if (now - this.lastWarned > 10000) {
          console.warn(`[Redis Adapter] Connection refused at ${this.redisUrl}. Verify Redis service.`);
          this.lastWarned = now;
        }
      } else {
        console.error('[Redis Adapter Error]:', err.message);
      }
    });
  }

  async setWithExpiry(key, value, ttlSeconds) {
    return this.client.set(key, value, 'EX', ttlSeconds);
  }

  async get(key) {
    return this.client.get(key);
  }

  async delete(key) {
    return this.client.del(key);
  }
}

module.exports = { RedisStorageAdapter };
