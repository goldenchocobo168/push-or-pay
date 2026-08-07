// Netlify Blobs -> Upstash Redis adapter, matching the exact interface the
// existing tests already exercise (see test/api.test.mjs's in-memory fake):
// setJSON(key, obj) / get(key, {type:'json'}) / list() -> {blobs:[{key}]}.
// This keeps api.js and send-reminders.js unchanged beyond the import line.
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

export function getStore(namespace) {
  const redis = new Redis({ url, token });
  const key = (k) => `${namespace}:${k}`;
  const indexKey = `${namespace}:__keys__`;

  return {
    async setJSON(k, value) {
      await Promise.all([redis.set(key(k), value), redis.sadd(indexKey, k)]);
    },
    async get(k) {
      const value = await redis.get(key(k));
      return value == null ? null : value;
    },
    async list() {
      const keys = await redis.smembers(indexKey);
      return { blobs: keys.map((k) => ({ key: k })) };
    },
  };
}
