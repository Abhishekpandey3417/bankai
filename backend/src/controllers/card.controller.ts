import type { Response } from "express";
import { z } from "zod";

import prisma from "../config/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const createCardSchema = z.object({
    lastFour: z
        .string()
        .regex(/^\d{4}$/, "Last four digits must contain exactly 4 numbers"),

    cardType: z
        .string()
        .min(2, "Card type is required"),

    expiryMonth: z
        .number()
        .int()
        .min(1)
        .max(12),

    expiryYear: z
        .number()
        .int()
        .min(new Date().getFullYear()),
});

const updateCardSchema = z.object({
    cardType: z.string().min(2).optional(),

    expiryMonth: z
        .number()
        .int()
        .min(1)
        .max(12)
        .optional(),

    expiryYear: z
        .number()
        .int()
        .min(new Date().getFullYear())
        .optional(),

    isActive: z.boolean().optional(),
});

export const createCard = async (
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

        const result = createCardSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid card data",
                errors: result.error.flatten().fieldErrors,
            });
        }

        const {
            lastFour,
            cardType,
            expiryMonth,
            expiryYear,
        } = result.data;

        const card = await prisma.card.create({
            data: {
                lastFour,
                cardType,
                expiryMonth,
                expiryYear,
                userId: req.user.userId,
            },
        });

        return res.status(201).json({
            success: true,
            message: "Card created successfully",
            data: {
                card,
            },
        });
    } catch (error) {
        console.error("Create card error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const getCards = async (
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

        const cards = await prisma.card.findMany({
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
                cards,
            },
        });
    } catch (error) {
        console.error("Get cards error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const getCardById = async (
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

        const card = await prisma.card.findFirst({
            where: {
                id,
                userId: req.user.userId,
            },
        });

        if (!card) {
            return res.status(404).json({
                success: false,
                message: "Card not found",
            });
        }

        return res.json({
            success: true,
            data: {
                card,
            },
        });
    } catch (error) {
        console.error("Get card error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const updateCard = async (
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

        const result = updateCardSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid card data",
                errors: result.error.flatten().fieldErrors,
            });
        }

        const {
            cardType,
            expiryMonth,
            expiryYear,
            isActive,
        } = result.data;

        if (
            cardType === undefined &&
            expiryMonth === undefined &&
            expiryYear === undefined &&
            isActive === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "At least one field is required",
            });
        }

        const existingCard = await prisma.card.findFirst({
            where: {
                id,
                userId: req.user.userId,
            },
        });

        if (!existingCard) {
            return res.status(404).json({
                success: false,
                message: "Card not found",
            });
        }

        const card = await prisma.card.update({
            where: {
                id,
            },
            data: {
                ...(cardType !== undefined && {
                    cardType,
                }),

                ...(expiryMonth !== undefined && {
                    expiryMonth,
                }),

                ...(expiryYear !== undefined && {
                    expiryYear,
                }),

                ...(isActive !== undefined && {
                    isActive,
                }),
            },
        });

        return res.json({
            success: true,
            message: "Card updated successfully",
            data: {
                card,
            },
        });
    } catch (error) {
        console.error("Update card error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const deleteCard = async (
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

        const existingCard = await prisma.card.findFirst({
            where: {
                id,
                userId: req.user.userId,
            },
        });

        if (!existingCard) {
            return res.status(404).json({
                success: false,
                message: "Card not found",
            });
        }

        await prisma.card.delete({
            where: {
                id,
            },
        });

        return res.json({
            success: true,
            message: "Card deleted successfully",
        });
    } catch (error) {
        console.error("Delete card error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};