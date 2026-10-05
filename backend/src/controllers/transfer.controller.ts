import type { Response } from "express";
import { z } from "zod";

import prisma from "../config/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

const createTransferSchema = z.object({
    fromAccountId: z.string().min(1, "Source account ID is required"),
    toAccountId: z.string().min(1, "Destination account ID is required"),
    amount: z.number().positive("Amount must be greater than 0"),
    description: z
        .string()
        .min(2, "Description must contain at least 2 characters"),
});

export const createTransfer = async (
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

        const result = createTransferSchema.safeParse(req.body);

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid transfer data",
                errors: result.error.flatten().fieldErrors,
            });
        }

        const {
            fromAccountId,
            toAccountId,
            amount,
            description,
        } = result.data;

        if (fromAccountId === toAccountId) {
            return res.status(400).json({
                success: false,
                message: "Source and destination accounts must be different",
            });
        }

        const fromAccount = await prisma.account.findFirst({
            where: {
                id: fromAccountId,
                userId: req.user.userId,
            },
        });

        if (!fromAccount) {
            return res.status(404).json({
                success: false,
                message: "Source account not found",
            });
        }

        const toAccount = await prisma.account.findUnique({
            where: {
                id: toAccountId,
            },
        });

        if (!toAccount) {
            return res.status(404).json({
                success: false,
                message: "Destination account not found",
            });
        }

        if (Number(fromAccount.balance) < amount) {
            return res.status(400).json({
                success: false,
                message: "Insufficient account balance",
            });
        }

        if (fromAccount.currency !== toAccount.currency) {
            return res.status(400).json({
                success: false,
                message: "Source and destination currencies must match",
            });
        }

        const transactionResult = await prisma.$transaction(async (tx) => {
            const updatedFromAccount = await tx.account.update({
                where: {
                    id: fromAccount.id,
                },
                data: {
                    balance: {
                        decrement: amount,
                    },
                },
            });

            const updatedToAccount = await tx.account.update({
                where: {
                    id: toAccount.id,
                },
                data: {
                    balance: {
                        increment: amount,
                    },
                },
            });

            const debitTransaction = await tx.transaction.create({
                data: {
                    amount,
                    type: "DEBIT",
                    description: `Transfer to ${toAccount.accountNumber}: ${description}`,
                    category: "TRANSFER",
                    accountId: fromAccount.id,
                    userId: req.user!.userId,
                },
            });

            const creditTransaction = await tx.transaction.create({
                data: {
                    amount,
                    type: "CREDIT",
                    description: `Transfer from ${fromAccount.accountNumber}: ${description}`,
                    category: "TRANSFER",
                    accountId: toAccount.id,
                    userId: toAccount.userId,
                },
            });

            return {
                updatedFromAccount,
                updatedToAccount,
                debitTransaction,
                creditTransaction,
            };
        });

        return res.status(201).json({
            success: true,
            message: "Transfer completed successfully",
            data: {
                transfer: {
                    fromAccountId: fromAccount.id,
                    toAccountId: toAccount.id,
                    amount,
                    currency: fromAccount.currency,
                    description,
                },
                balances: {
                    source: transactionResult.updatedFromAccount.balance,
                    destination: transactionResult.updatedToAccount.balance,
                },
                transactions: {
                    debit: transactionResult.debitTransaction,
                    credit: transactionResult.creditTransaction,
                },
            },
        });
    } catch (error) {
        console.error("Create transfer error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};