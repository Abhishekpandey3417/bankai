import {
    notificationQueue,
    type NotificationJobData,
} from "../queues/notification.queue.js";

export const queueNotification =
    async (
        data: NotificationJobData
    ) => {
        const job =
            await notificationQueue.add(
                "create-notification",
                data
            );

        return {
            jobId: job.id,
        };
    };