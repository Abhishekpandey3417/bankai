import type { Response } from "express";
import { z } from "zod";

import prisma from "../config/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

import {
    checkAndConsumeAIRateLimit,
    getCachedAIResponse,
    cacheAIResponse,
    generateBankingResponse,
} from "../services/ai.service.js";

const askAISchema = z.object({
    question: z
        .string()
        .min(2, "Question must contain at least 2 characters")
        .max(500, "Question is too long"),
});

export const askAI = async (
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

        const userId = req.user.userId;

        /*
         * Validate question.
         */
        const result = askAISchema.safeParse(
            req.body
        );

        if (!result.success) {
            return res.status(400).json({
                success: false,
                message: "Invalid question",
                errors:
                    result.error.flatten()
                        .fieldErrors,
            });
        }

        const question = result.data.question;

        /*
         * Check cache first.
         *
         * Cached responses do not consume
         * the Gemini request limit.
         */
        const cachedAnswer =
            getCachedAIResponse(
                userId,
                question
            );

        if (cachedAnswer) {
            return res.json({
                success: true,
                data: {
                    question,
                    answer: cachedAnswer,

                    aiUsage: {
                        limitPerHour: 20,
                        remainingThisHour: null,
                    },

                    cache: {
                        hit: true,
                        ttlMinutes: 5,
                    },
                },
            });
        }

        /*
         * Check 20 requests/hour limit.
         */
        const rateLimit =
            await checkAndConsumeAIRateLimit(
                userId
            );

        if (!rateLimit.allowed) {
            return res.status(429).json({
                success: false,
                message:
                    "AI request limit reached. Please try again later.",
                limit: 20,
                remaining: 0,
                retryAfterSeconds:
                    rateLimit.retryAfterSeconds,
            });
        }

        /*
         * Get user.
         */
        const user =
            await prisma.user.findUnique({
                where: {
                    id: userId,
                },
                select: {
                    name: true,
                },
            });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        /*
         * Get accounts.
         */
        const accounts =
            await prisma.account.findMany({
                where: {
                    userId,
                },
                select: {
                    accountNumber: true,
                    type: true,
                    balance: true,
                    currency: true,
                },
            });

        /*
         * Get recent transactions.
         */
        const transactions =
            await prisma.transaction.findMany({
                where: {
                    userId,
                },
                orderBy: {
                    createdAt: "desc",
                },
                take: 20,
                select: {
                    amount: true,
                    type: true,
                    description: true,
                    category: true,
                },
            });

        /*
         * Get transactions for totals.
         */
        const allTransactions =
            await prisma.transaction.findMany({
                where: {
                    userId,
                },
                select: {
                    amount: true,
                    type: true,
                },
            });

        const totalBalance =
            accounts.reduce(
                (sum, account) =>
                    sum + Number(account.balance),
                0
            );

        const totalIncome =
            allTransactions
                .filter(
                    (transaction) =>
                        transaction.type === "CREDIT"
                )
                .reduce(
                    (sum, transaction) =>
                        sum +
                        Number(transaction.amount),
                    0
                );

        const totalExpenses =
            allTransactions
                .filter(
                    (transaction) =>
                        transaction.type === "DEBIT"
                )
                .reduce(
                    (sum, transaction) =>
                        sum +
                        Number(transaction.amount),
                    0
                );

        /*
         * Call Gemini.
         */
        const answer =
            await generateBankingResponse(
                question,
                {
                    userName: user.name,

                    totalBalance,
                    totalIncome,
                    totalExpenses,

                    accounts:
                        accounts.map(
                            (account) => ({
                                accountNumber:
                                    account.accountNumber,
                                type: account.type,
                                balance:
                                    Number(
                                        account.balance
                                    ),
                                currency:
                                    account.currency,
                            })
                        ),

                    recentTransactions:
                        transactions.map(
                            (transaction) => ({
                                amount:
                                    Number(
                                        transaction.amount
                                    ),
                                type:
                                    transaction.type,
                                description:
                                    transaction.description,
                                category:
                                    transaction.category,
                            })
                        ),
                }
            );

        /*
         * Save Gemini response.
         */
        cacheAIResponse(
            userId,
            question,
            answer
        );

        return res.json({
            success: true,

            data: {
                question,
                answer,

                aiUsage: {
                    limitPerHour: 20,
                    remainingThisHour:
                        rateLimit.remaining,
                },

                cache: {
                    hit: false,
                    ttlMinutes: 5,
                },
            },
        });
    } catch (error: any) {
        console.error(
            "AI controller error:",
            error
        );

        /*
         * Handle Gemini 429 errors.
         */
        if (
            error?.status === 429 ||
            error?.code === 429 ||
            error?.message?.includes("429") ||
            error?.message
                ?.toLowerCase()
                ?.includes("quota")
        ) {
            return res.status(429).json({
                success: false,
                message:
                    "Gemini API quota or rate limit has been exceeded. Please try again later.",
            });
        }

        return res.status(500).json({
            success: false,
            message:
                "Unable to process AI request",
        });
    }
};