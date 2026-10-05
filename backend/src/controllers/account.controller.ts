import type { Response } from "express";
import { z } from "zod";

import prisma from "../config/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const createAccountSchema = z.object({
    type: z.enum(["SAVINGS", "CURRENT"]),
    currency: z.string().length(3).default("INR"),
});

const updateAccountSchema = z.object({
    type: z.enum(["SAVINGS", "CURRENT"]).optional(),
    currency: z.string().length(3).optional(),
});

const getParamId = (id: string | string[] | undefined): string | null => {
    if (typeof id !== "string" || id.length === 0) {
        return null;
    }

    return id;
};

export const createAccount = async (
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

        const result = createAccountSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid account data",
                errors: result.error.flatten().fieldErrors,
            });
        }

        const { type, currency } = result.data;

        const accountNumber = `BANK${Date.now()}${Math.floor(
            Math.random() * 1000
        )
            .toString()
            .padStart(3, "0")}`;

        const account = await prisma.account.create({
            data: {
                accountNumber,
                type,
                currency,
                balance: 0,
                userId: req.user.userId,
            },
        });

        return res.status(201).json({
            success: true,
            message: "Account created successfully",
            data: {
                account,
            },
        });
    } catch (error) {
        console.error("Create account error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const getAccounts = async (
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

        const accounts = await prisma.account.findMany({
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
                accounts,
            },
        });
    } catch (error) {
        console.error("Get accounts error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const getAccountById = async (
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

        const id = getParamId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid account ID",
            });
        }

        const account = await prisma.account.findFirst({
            where: {
                id,
                userId: req.user.userId,
            },
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                message: "Account not found",
            });
        }

        return res.json({
            success: true,
            data: {
                account,
            },
        });
    } catch (error) {
        console.error("Get account error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const updateAccount = async (
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

        const id = getParamId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid account ID",
            });
        }

        const result = updateAccountSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid account data",
                errors: result.error.flatten().fieldErrors,
            });
        }

        const existingAccount = await prisma.account.findFirst({
            where: {
                id,
                userId: req.user.userId,
            },
        });

        if (!existingAccount) {
            return res.status(404).json({
                success: false,
                message: "Account not found",
            });
        }

        if (
            result.data.type === undefined &&
            result.data.currency === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "At least one field is required",
            });
        }

        const account = await prisma.account.update({
            where: {
                id,
            },
            data: {
                ...(result.data.type !== undefined && {
                    type: result.data.type,
                }),
                ...(result.data.currency !== undefined && {
                    currency: result.data.currency,
                }),
            },
        });

        return res.json({
            success: true,
            message: "Account updated successfully",
            data: {
                account,
            },
        });
    } catch (error) {
        console.error("Update account error:", error);

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

        const id = getParamId(req.params.id);

        if (!id) {
            return res.status(400).json({
                success: false,
                message: "Invalid account ID",
            });
        }

        const existingAccount = await prisma.account.findFirst({
            where: {
                id,
                userId: req.user.userId,
            },
        });

        if (!existingAccount) {
            return res.status(404).json({
                success: false,
                message: "Account not found",
            });
        }

        if (Number(existingAccount.balance) !== 0) {
            return res.status(400).json({
                success: false,
                message: "Account balance must be zero before deletion",
            });
        }

        await prisma.account.delete({
            where: {
                id,
            },
        });

        return res.json({
            success: true,
            message: "Account deleted successfully",
        });
    } catch (error) {
        console.error("Delete account error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};