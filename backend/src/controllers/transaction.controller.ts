import type { Response } from "express";
import { z } from "zod";

import prisma from "../config/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const createTransactionSchema = z.object({
    accountId: z.string().min(1, "Account ID is required"),
    amount: z.number().positive("Amount must be greater than 0"),
    type: z.enum(["CREDIT", "DEBIT"]),
    description: z
        .string()
        .min(2, "Description must contain at least 2 characters"),
    category: z.string().optional(),
});

const updateTransactionSchema = z.object({
    description: z
        .string()
        .min(2, "Description must contain at least 2 characters")
        .optional(),
    category: z.string().optional(),
});

export const createTransaction = async (
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

        const result = createTransactionSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid transaction data",
                errors: result.error.flatten().fieldErrors,
            });
        }

        const {
            accountId,
            amount,
            type,
            description,
            category,
        } = result.data;

        const account = await prisma.account.findFirst({
            where: {
                id: accountId,
                userId: req.user.userId,
            },
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                message: "Account not found",
            });
        }

        const currentBalance = Number(account.balance);

        if (type === "DEBIT" && currentBalance < amount) {
            return res.status(400).json({
                success: false,
                message: "Insufficient account balance",
            });
        }

        const newBalance =
            type === "CREDIT"
                ? currentBalance + amount
                : currentBalance - amount;

        const transaction = await prisma.$transaction(async (tx) => {
            const createdTransaction = await tx.transaction.create({
                data: {
                    amount,
                    type,
                    description,
                    category,
                    accountId,
                    userId: req.user!.userId,
                },
            });

            await tx.account.update({
                where: {
                    id: accountId,
                },
                data: {
                    balance: newBalance,
                },
            });

            return createdTransaction;
        });

        return res.status(201).json({
            success: true,
            message: "Transaction created successfully",
            data: {
                transaction,
                balance: newBalance,
            },
        });
    } catch (error) {
        console.error("Create transaction error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const getTransactions = async (
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

        const transactions = await prisma.transaction.findMany({
            where: {
                userId: req.user.userId,
            },
            orderBy: {
                createdAt: "desc",
            },
            include: {
                account: {
                    select: {
                        id: true,
                        accountNumber: true,
                        type: true,
                        currency: true,
                    },
                },
            },
        });

        return res.json({
            success: true,
            data: {
                transactions,
            },
        });
    } catch (error) {
        console.error("Get transactions error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const getTransactionById = async (
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

        const transaction = await prisma.transaction.findFirst({
            where: {
                id,
                userId: req.user.userId,
            },
            include: {
                account: {
                    select: {
                        id: true,
                        accountNumber: true,
                        type: true,
                        currency: true,
                    },
                },
            },
        });

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found",
            });
        }

        return res.json({
            success: true,
            data: {
                transaction,
            },
        });
    } catch (error) {
        console.error("Get transaction error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const updateTransaction = async (
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

        const result = updateTransactionSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid transaction data",
                errors: result.error.flatten().fieldErrors,
            });
        }

        const { description, category } = result.data;

        if (description === undefined && category === undefined) {
            return res.status(400).json({
                success: false,
                message: "At least one field is required",
            });
        }

        const existingTransaction =
            await prisma.transaction.findFirst({
                where: {
                    id,
                    userId: req.user.userId,
                },
            });

        if (!existingTransaction) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found",
            });
        }

        const transaction = await prisma.transaction.update({
            where: {
                id,
            },
            data: {
                ...(description !== undefined && {
                    description,
                }),
                ...(category !== undefined && {
                    category,
                }),
            },
        });

        return res.json({
            success: true,
            message: "Transaction updated successfully",
            data: {
                transaction,
            },
        });
    } catch (error) {
        console.error("Update transaction error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const deleteTransaction = async (
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

        const transaction = await prisma.transaction.findFirst({
            where: {
                id,
                userId: req.user.userId,
            },
        });

        if (!transaction) {
            return res.status(404).json({
                success: false,
                message: "Transaction not found",
            });
        }

        const account = await prisma.account.findFirst({
            where: {
                id: transaction.accountId,
                userId: req.user.userId,
            },
        });

        if (!account) {
            return res.status(404).json({
                success: false,
                message: "Associated account not found",
            });
        }

        const currentBalance = Number(account.balance);

        const restoredBalance =
            transaction.type === "CREDIT"
                ? currentBalance - Number(transaction.amount)
                : currentBalance + Number(transaction.amount);

        if (restoredBalance < 0) {
            return res.status(400).json({
                success: false,
                message:
                    "Transaction cannot be deleted because it would result in a negative balance",
            });
        }

        await prisma.$transaction(async (tx) => {
            await tx.transaction.delete({
                where: {
                    id,
                },
            });

            await tx.account.update({
                where: {
                    id: account.id,
                },
                data: {
                    balance: restoredBalance,
                },
            });
        });

        return res.json({
            success: true,
            message: "Transaction deleted successfully",
            data: {
                balance: restoredBalance,
            },
        });
    } catch (error) {
        console.error("Delete transaction error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};