import { Router } from "express";

import {
    createNotification,
    getNotifications,
    getNotificationById,
    markNotificationAsRead,
    deleteNotification,
} from "../controllers/notification.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.post("/", createNotification);

router.get("/", getNotifications);

router.get("/:id", getNotificationById);

router.put("/:id/read", markNotificationAsRead);

router.delete("/:id", deleteNotification);

export default router;