// src/cache/redis.js
const { createClient } = require('redis');
require('dotenv').config();

let client = null;
let redisAvailable = false;

const connect = async () => {
  if (!process.env.REDIS_URL) {
    console.log('Redis: no REDIS_URL set, running without cache');
    return;
  }

  try {
    client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (err) => {
      // Log but don't crash — Redis is optional for deduplication
      if (redisAvailable) console.error('Redis error:', err.message);
    });
    await client.connect();
    redisAvailable = true;
    console.log('Redis connected');
  } catch (err) {
    console.warn('Redis unavailable — running without cache:', err.message);
    redisAvailable = false;
  }
};

const isDuplicate = async (messageId) => {
  if (!redisAvailable || !client) return false;
  try {
    const exists = await client.get(`msg:${messageId}`);
    return !!exists;
  } catch { return false; }
};

const markProcessed = async (messageId) => {
  if (!redisAvailable || !client) return;
  try {
    await client.setEx(`msg:${messageId}`, 300, '1');
  } catch { /* silent */ }
};

module.exports = { connect, isDuplicate, markProcessed, getClient: () => client };