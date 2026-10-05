import type { Request, Response } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";

import prisma from "../config/prisma.js";
import { generateToken } from "../utils/jwt.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const registerSchema = z.object({
    name: z.string().min(2, "Name must contain at least 2 characters"),
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must contain at least 6 characters"),
});

const loginSchema = z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(1, "Password is required"),
});

const updateProfileSchema = z.object({
    name: z.string().min(2).optional(),
    email: z.string().email().optional(),
});

export const register = async (req: Request, res: Response) => {
    try {
        const result = registerSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid request data",
                errors: result.error.flatten().fieldErrors,
            });
        }

        const { name, email, password } = result.data;

        const existingUser = await prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "User with this email already exists",
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: {
                name,
                email,
                passwordHash,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
            },
        });

        const token = generateToken({
            userId: user.id,
            role: user.role,
        });

        return res.status(201).json({
            success: true,
            message: "Registration successful",
            data: {
                user,
                token,
            },
        });
    } catch (error) {
        console.error("Register error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const result = loginSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid request data",
                errors: result.error.flatten().fieldErrors,
            });
        }

        const { email, password } = result.data;

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        const passwordValid = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!passwordValid) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        const token = generateToken({
            userId: user.id,
            role: user.role,
        });

        return res.json({
            success: true,
            message: "Login successful",
            data: {
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                },
                token,
            },
        });
    } catch (error) {
        console.error("Login error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const getProfile = async (
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

        const { id } = req.params;

        if (id !== req.user.userId) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to access this profile",
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                id,
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        return res.json({
            success: true,
            data: {
                user,
            },
        });
    } catch (error) {
        console.error("Get profile error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const updateProfile = async (
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

        const { id } = req.params;

        if (id !== req.user.userId) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to update this profile",
            });
        }

        const result = updateProfileSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid profile data",
                errors: result.error.flatten().fieldErrors,
            });
        }

        const { name, email } = result.data;

        if (name === undefined && email === undefined) {
            return res.status(400).json({
                success: false,
                message: "At least one field is required",
            });
        }

        if (email) {
            const existingUser = await prisma.user.findFirst({
                where: {
                    email,
                    NOT: {
                        id,
                    },
                },
            });

            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    message: "Email is already in use",
                });
            }
        }

        const user = await prisma.user.update({
            where: {
                id,
            },
            data: {
                ...(name !== undefined && { name }),
                ...(email !== undefined && { email }),
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return res.json({
            success: true,
            message: "Profile updated successfully",
            data: {
                user,
            },
        });
    } catch (error) {
        console.error("Update profile error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const logout = async (
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

        return res.json({
            success: true,
            message: "Logout successful. Please remove the token from the client.",
        });
    } catch (error) {
        console.error("Logout error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const deleteAccount = async (
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

        const { id } = req.params;

        if (id !== req.user.userId) {
            return res.status(403).json({
                success: false,
                message: "You are not allowed to delete this profile",
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                id,
            },
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        await prisma.user.delete({
            where: {
                id,
            },
        });

        res.clearCookie("bankai_token", {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite:
                process.env.NODE_ENV === "production" ? "none" : "lax",
        });

        return res.json({
            success: true,
            message: "User profile deleted successfully",
        });
    } catch (error) {
        console.error("Delete profile error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};