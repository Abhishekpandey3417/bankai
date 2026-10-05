
import "dotenv/config";


import {
    Worker,
    type Job,
} from "bullmq";

import Redis from "ioredis";

import {
    PrismaPg,
} from "@prisma/adapter-pg";

import { PrismaClient } from "../generated/prisma/client.js";


// --------------------------------------------------
// Environment variables
// --------------------------------------------------

const redisUrl =
    process.env.REDIS_URL ||
    "redis://localhost:6379";

const databaseUrl =
    process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error(
        "DATABASE_URL is not defined"
    );
}


// --------------------------------------------------
// Redis connection
// --------------------------------------------------

// --------------------------------------------------
// Redis connection
// --------------------------------------------------

const connection = new (Redis as any)(redisUrl, {
    maxRetriesPerRequest: null,
});

connection.on(
    "connect",
    () => {
        console.log(
            "Worker Redis connected"
        );
    }
);

connection.on(
    "error",
    (error: Error) => {
        console.error(
            "Worker Redis error:",
            error
        );
    }
);


// --------------------------------------------------
// Prisma connection
// --------------------------------------------------

const adapter =
    new PrismaPg({
        connectionString:
            databaseUrl,
    });

const prisma =
    new PrismaClient({
        adapter,
    });


// --------------------------------------------------
// Notification job data
// --------------------------------------------------

interface NotificationJobData {
    userId: string;
    title: string;
    message: string;
    type: string;
}


// --------------------------------------------------
// Notification processor
// --------------------------------------------------

const processNotification =
    async (
        job: Job<NotificationJobData>
    ) => {

        const {
            userId,
            title,
            message,
            type,
        } = job.data;

        console.log(
            `Processing notification job ${job.id}`
        );


        // Check whether user exists
        const user =
            await prisma.user.findUnique({
                where: {
                    id: userId,
                },
                select: {
                    id: true,
                },
            });

        if (!user) {
            throw new Error(
                `User ${userId} not found`
            );
        }


        // Create notification
        const notification =
            await prisma.notification.create({
                data: {
                    userId,
                    title,
                    message,
                    type,
                },
            });

        console.log(
            `Notification created: ${notification.id}`
        );


        return {
            notificationId:
                notification.id,
        };
    };


// --------------------------------------------------
// BullMQ worker
// --------------------------------------------------

const worker =
    new Worker<NotificationJobData>(
        "bankai-notifications",
        processNotification,
        {
            connection,
            concurrency: 5,
        }
    );


// --------------------------------------------------
// Worker events
// --------------------------------------------------

worker.on(
    "completed",
    (job) => {
        console.log(
            `Job ${job.id} completed`
        );
    }
);

worker.on(
    "failed",
    (job, error) => {
        console.error(
            `Job ${job?.id} failed:`,
            error
        );
    }
);

worker.on(
    "error",
    (error) => {
        console.error(
            "Worker error:",
            error
        );
    }
);


// --------------------------------------------------
// Worker started
// --------------------------------------------------

console.log(
    "BankAI notification worker started"
);


// --------------------------------------------------
// Graceful shutdown
// --------------------------------------------------

const shutdown =
    async () => {

        console.log(
            "Shutting down worker..."
        );

        try {
            await worker.close();

            await prisma.$disconnect();

            await connection.quit();

            console.log(
                "Worker shutdown completed"
            );

            process.exit(0);

        } catch (error) {

            console.error(
                "Error during worker shutdown:",
                error
            );

            process.exit(1);
        }
    };


// --------------------------------------------------
// Process signals
// --------------------------------------------------

process.on(
    "SIGINT",
    shutdown
);

process.on(
    "SIGTERM",
    shutdown
);

