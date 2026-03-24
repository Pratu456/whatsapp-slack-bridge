// src/cache/redis.js
const { createClient } = require('redis');
require('dotenv').config();

const client = createClient({ url: process.env.REDIS_URL });

client.on('error', (err) => console.error('Redis error:', err));

const connect = async () => {
  await client.connect();
  console.log('Redis connected');
};

const isDuplicate = async (messageId) => {
  const exists = await client.get(`msg:${messageId}`);
  return !!exists;
};

const markProcessed = async (messageId) => {
  await client.setEx(`msg:${messageId}`, 300, '1');
};

module.exports = { connect, isDuplicate, markProcessed };