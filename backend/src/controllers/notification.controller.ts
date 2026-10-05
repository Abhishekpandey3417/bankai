import type { Response } from "express";
import { z } from "zod";

import prisma from "../config/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const createNotificationSchema = z.object({
    title: z.string().min(2, "Title is required"),
    message: z.string().min(2, "Message is required"),
    type: z.string().min(2, "Notification type is required"),
});

export const createNotification = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        const result = createNotificationSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid notification data",
                errors: result.error.flatten().fieldErrors,
            });
        }

        const notification = await prisma.notification.create({
            data: {
                title: result.data.title,
                message: result.data.message,
                type: result.data.type,
                userId: req.user.userId,
            },
        });

        return res.status(201).json({
            success: true,
            message: "Notification created successfully",
            data: {
                notification,
            },
        });
    } catch (error) {
        console.error("Create notification error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const getNotifications = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        const notifications = await prisma.notification.findMany({
            where: {
                userId: req.user.userId,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        return res.json({
            success: true,
            data: {
                notifications,
            },
        });
    } catch (error) {
        console.error("Get notifications error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const getNotificationById = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        const id = req.params.id as string;

        const notification = await prisma.notification.findFirst({
            where: {
                id,
                userId: req.user.userId,
            },
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found",
            });
        }

        return res.json({
            success: true,
            data: {
                notification,
            },
        });
    } catch (error) {
        console.error("Get notification error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const markNotificationAsRead = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        const id = req.params.id as string;

        const notification = await prisma.notification.findFirst({
            where: {
                id,
                userId: req.user.userId,
            },
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found",
            });
        }

        const updatedNotification =
            await prisma.notification.update({
                where: {
                    id,
                },
                data: {
                    isRead: true,
                },
            });

        return res.json({
            success: true,
            message: "Notification marked as read",
            data: {
                notification: updatedNotification,
            },
        });
    } catch (error) {
        console.error("Mark notification read error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const deleteNotification = async (
    req: AuthRequest,
    res: Response
) => {
    try {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required",
            });
        }

        const id = req.params.id as string;

        const notification = await prisma.notification.findFirst({
            where: {
                id,
                userId: req.user.userId,
            },
        });

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: "Notification not found",
            });
        }

        await prisma.notification.delete({
            where: {
                id,
            },
        });

        return res.json({
            success: true,
            message: "Notification deleted successfully",
        });
    } catch (error) {
        console.error("Delete notification error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};