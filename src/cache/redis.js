// src/cache/redis.js
const { createClient } = require('redis');
require('dotenv').config();

let client = null;
let connected = false;

const connect = async () => {
  if (!process.env.REDIS_URL) {
    console.log('Redis: no REDIS_URL set, running without cache');
    return;
  }
  try {
    client = createClient({ url: process.env.REDIS_URL });
    client.on('error', (err) => console.error('Redis error:', err));
    await client.connect();
    connected = true;
    console.log('Redis connected');
  } catch (err) {
    console.error('Redis connection failed, running without cache:', err.message);
    connected = false;
  }
};

const isDuplicate = async (messageId) => {
  if (!connected || !client) return false;
  try {
    const exists = await client.get(`msg:${messageId}`);
    return !!exists;
  } catch (err) {
    return false;
  }
};

const markProcessed = async (messageId) => {
  if (!connected || !client) return;
  try {
    await client.setEx(`msg:${messageId}`, 300, '1');
  } catch (err) {}
};

module.exports = { connect, isDuplicate, markProcessed };