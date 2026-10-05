import { Queue } from "bullmq";
import redis from "../config/redis.js";

export interface NotificationJobData {
    userId: string;
    title: string;
    message: string;
    type: string;
}

export const notificationQueue =
    new Queue<NotificationJobData>(
        "bankai-notifications",
        {
            connection: redis,
            defaultJobOptions: {
                attempts: 3,
                backoff: {
                    type: "exponential",
                    delay: 2000,
                },
                removeOnComplete: 100,
                removeOnFail: 100,
            },
        }
    );