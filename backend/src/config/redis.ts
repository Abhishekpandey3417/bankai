import "dotenv/config";
import { Redis } from "ioredis";

const redisUrl =
    process.env.REDIS_URL ||
    "redis://localhost:6379";

const redis = new Redis(redisUrl, {
    maxRetriesPerRequest: null,
});

redis.on("connect", () => {
    console.log("Redis connected");
});

redis.on("ready", () => {
    console.log("Redis ready");
});

redis.on("error", (error: Error) => {
    console.error("Redis error:", error);
});

redis.on("close", () => {
    console.log("Redis connection closed");
});

export default redis;