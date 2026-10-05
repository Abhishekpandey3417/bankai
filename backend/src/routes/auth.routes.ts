import { Router } from "express";

import {
    register,
    login,
    getProfile,
    updateProfile,
    logout,
    deleteAccount,
} from "../controllers/auth.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

// Public routes
router.post("/register", register);
router.post("/login", login);

// Protected user routes
router.get("/users/:id", authenticate, getProfile);
router.put("/users/:id", authenticate, updateProfile);
router.delete("/users/:id", authenticate, deleteAccount);

// Logout
router.post("/logout", authenticate, logout);

export default router;