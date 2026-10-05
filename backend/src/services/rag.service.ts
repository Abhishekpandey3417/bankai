import { GoogleGenAI } from "@google/genai";
import prisma from "../config/prisma.js";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined");
}

const ai = new GoogleGenAI({
    apiKey,
});

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSION = 768;

const chunkText = (
    text: string,
    maxLength = 1200,
    overlap = 200
): string[] => {
    const normalized = text
        .replace(/\r\n/g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();

    const chunks: string[] = [];

    let start = 0;

    while (start < normalized.length) {
        const end = Math.min(
            start + maxLength,
            normalized.length
        );

        const chunk = normalized.slice(start, end).trim();

        if (chunk) {
            chunks.push(chunk);
        }

        if (end >= normalized.length) {
            break;
        }

        start = end - overlap;
    }

    return chunks;
};

const createEmbedding = async (
    text: string,
    taskType: "RETRIEVAL_DOCUMENT" | "RETRIEVAL_QUERY"
): Promise<number[]> => {
    const response = await ai.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text,
        config: {
            taskType,
            outputDimensionality: EMBEDDING_DIMENSION,
        },
    });

    const values = response.embeddings?.[0]?.values;

    if (!values || values.length === 0) {
        throw new Error("Failed to generate embedding");
    }

    return values;
};

const cosineSimilarity = (
    a: number[],
    b: number[]
): number => {
    if (a.length !== b.length) {
        return 0;
    }

    let dot = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magnitudeA += a[i] * a[i];
        magnitudeB += b[i] * b[i];
    }

    if (magnitudeA === 0 || magnitudeB === 0) {
        return 0;
    }

    return (
        dot /
        (Math.sqrt(magnitudeA) *
            Math.sqrt(magnitudeB))
    );
};

export const ingestKnowledgeDocument = async (
    source: string,
    content: string
): Promise<number> => {
    const chunks = chunkText(content);

    await prisma.knowledgeChunk.deleteMany({
        where: { source },
    });

    let inserted = 0;

    for (const chunk of chunks) {
        const embedding = await createEmbedding(
            chunk,
            "RETRIEVAL_DOCUMENT"
        );

        await prisma.knowledgeChunk.create({
            data: {
                content: chunk,
                source,
                embedding,
            },
        });

        inserted++;
    }

    return inserted;
};

export const retrieveRelevantKnowledge = async (
    question: string,
    topK = 4
): Promise<
    Array<{
        content: string;
        source: string;
        score: number;
    }>
> => {
    const queryEmbedding = await createEmbedding(
        question,
        "RETRIEVAL_QUERY"
    );

    const chunks = await prisma.knowledgeChunk.findMany();

    return chunks
        .map((chunk) => {
            const embedding =
                chunk.embedding as number[];

            return {
                content: chunk.content,
                source: chunk.source,
                score: cosineSimilarity(
                    queryEmbedding,
                    embedding
                ),
            };
        })
        .filter((chunk) => chunk.score >= 0.35)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
};