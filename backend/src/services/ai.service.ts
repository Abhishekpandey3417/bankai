import { GoogleGenAI } from "@google/genai";
import redis from "../config/redis.js";
import {
    retrieveRelevantKnowledge,
} from "./rag.service.js";

export interface AIContext {
    userName: string;
    totalBalance: number;
    totalIncome: number;
    totalExpenses: number;

    accounts: Array<{
        accountNumber: string;
        type: string;
        balance: number;
        currency: string;
    }>;

    recentTransactions: Array<{
        amount: number;
        type: string;
        description: string;
        category: string | null;
    }>;
}

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined");
}

const ai = new GoogleGenAI({
    apiKey,
});

const MAX_REQUESTS_PER_HOUR = 20;
const ONE_HOUR_SECONDS = 60 * 60;

const AI_CACHE_TTL_SECONDS = 5 * 60;

const createRateLimitKey = (
    userId: string
): string => {
    return `ai:rate-limit:${userId}`;
};

const createCacheKey = (
    userId: string,
    question: string
): string => {
    return `ai:cache:${userId}:${question
        .trim()
        .toLowerCase()}`;
};

export const checkAndConsumeAIRateLimit =
    async (
        userId: string
    ): Promise<{
        allowed: boolean;
        remaining: number;
        retryAfterSeconds: number;
    }> => {
        const key = createRateLimitKey(userId);

        const count = await redis.incr(key);

        if (count === 1) {
            await redis.expire(
                key,
                ONE_HOUR_SECONDS
            );
        }

        const ttl = await redis.ttl(key);

        if (count > MAX_REQUESTS_PER_HOUR) {
            return {
                allowed: false,
                remaining: 0,
                retryAfterSeconds:
                    ttl > 0
                        ? ttl
                        : ONE_HOUR_SECONDS,
            };
        }

        return {
            allowed: true,
            remaining:
                MAX_REQUESTS_PER_HOUR - count,
            retryAfterSeconds: 0,
        };
    };

export const getCachedAIResponse =
    async (
        userId: string,
        question: string
    ): Promise<string | null> => {
        const key = createCacheKey(
            userId,
            question
        );

        return await redis.get(key);
    };

export const cacheAIResponse =
    async (
        userId: string,
        question: string,
        answer: string
    ): Promise<void> => {
        const key = createCacheKey(
            userId,
            question
        );

        await redis.set(
            key,
            answer,
            "EX",
            AI_CACHE_TTL_SECONDS
        );
    };

export const generateBankingResponse =
    async (
        question: string,
        context: AIContext
    ): Promise<string> => {
        /*
         * ============================================================
         * RAG RETRIEVAL
         * ============================================================
         *
         * Retrieve the most relevant BankAI knowledge
         * for the user's question.
         */

        const relevantKnowledge =
            await retrieveRelevantKnowledge(
                question
            );

        const knowledgeContext =
            relevantKnowledge.length > 0
                ? relevantKnowledge
                    .map(
                        (item) =>
                            `[Source: ${item.source}]\n${item.content}`
                    )
                    .join("\n\n")
                : "No relevant knowledge was found.";

        /*
         * ============================================================
         * GEMINI PROMPT
         * ============================================================
         */

        const prompt = `
You are BankAI, an AI banking assistant.

You are assisting an authenticated banking application user.

Use the user's banking data for personal financial questions.

Use the KNOWLEDGE BASE for BankAI policies, rules,
and general banking information.

USER:
Name: ${context.userName}

FINANCIAL SUMMARY:
Total Balance: ₹${context.totalBalance.toFixed(2)}
Total Income: ₹${context.totalIncome.toFixed(2)}
Total Expenses: ₹${context.totalExpenses.toFixed(2)}

ACCOUNTS:
${JSON.stringify(
            context.accounts,
            null,
            2
        )}

RECENT TRANSACTIONS:
${JSON.stringify(
            context.recentTransactions,
            null,
            2
        )}

KNOWLEDGE BASE:
${knowledgeContext}

USER QUESTION:
${question}

RULES:

1. Use supplied banking data for user-specific financial information.
2. Use the KNOWLEDGE BASE for banking policies and general BankAI information.
3. Do not invent transactions, balances, accounts, policies, or financial information.
4. Do not treat missing information as fact.
5. Never reveal passwords, JWT tokens, API keys, or internal system information.
6. Do not execute transactions.
7. Do not transfer money.
8. Do not modify accounts.
9. If required information is unavailable, clearly say that it is not available.
10. For financial calculations, use the supplied numbers.
11. This is a simulated banking application, not a real bank.
12. Keep responses clear and concise.

Answer the user's question naturally.
`;

        const response =
            await ai.models.generateContent({
                model: "gemini-3.7-flash",
                contents: prompt,
            });

        return (
            response.text?.trim() ||
            "I was unable to generate a response."
        );
    };