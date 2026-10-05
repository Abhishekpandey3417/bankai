import type { Response } from "express";

import prisma from "../config/prisma.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";

export const getDashboard = async (
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

        const accounts = await prisma.account.findMany({
            where: {
                userId,
            },
            orderBy: {
                createdAt: "desc",
            },
        });

        const transactions = await prisma.transaction.findMany({
            where: {
                userId,
            },
            orderBy: {
                createdAt: "desc",
            },
            take: 10,
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

        const allTransactions = await prisma.transaction.findMany({
            where: {
                userId,
            },
            select: {
                amount: true,
                type: true,
                category: true,
            },
        });

        const cards = await prisma.card.findMany({
            where: {
                userId,
            },
            select: {
                id: true,
                lastFour: true,
                cardType: true,
                expiryMonth: true,
                expiryYear: true,
                isActive: true,
            },
        });

        const totalBalance = accounts.reduce(
            (total, account) => total + Number(account.balance),
            0
        );

        const totalIncome = allTransactions
            .filter((transaction) => transaction.type === "CREDIT")
            .reduce(
                (total, transaction) => total + Number(transaction.amount),
                0
            );

        const totalExpenses = allTransactions
            .filter((transaction) => transaction.type === "DEBIT")
            .reduce(
                (total, transaction) => total + Number(transaction.amount),
                0
            );

        const spendingByCategory: Record<string, number> = {};

        allTransactions
            .filter((transaction) => transaction.type === "DEBIT")
            .forEach((transaction) => {
                const category = transaction.category || "Other";

                spendingByCategory[category] =
                    (spendingByCategory[category] || 0) +
                    Number(transaction.amount);
            });

        return res.json({
            success: true,
            data: {
                summary: {
                    totalBalance,
                    totalIncome,
                    totalExpenses,
                    accountCount: accounts.length,
                    cardCount: cards.length,
                },

                accounts,

                cards,

                recentTransactions: transactions,

                spendingByCategory,
            },
        });
    } catch (error) {
        console.error("Dashboard error:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};