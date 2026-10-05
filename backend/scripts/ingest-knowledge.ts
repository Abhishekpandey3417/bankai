import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ingestKnowledgeDocument,
} from "../src/services/rag.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const knowledgeDirectory = path.join(
  __dirname,
  "../knowledge"
);

const run = async (): Promise<void> => {
  const files = await fs.readdir(
    knowledgeDirectory
  );

  const markdownFiles = files.filter((file) =>
    file.endsWith(".md")
  );

  if (markdownFiles.length === 0) {
    throw new Error(
      "No knowledge documents found"
    );
  }

  for (const file of markdownFiles) {
    const filePath = path.join(
      knowledgeDirectory,
      file
    );

    const content = await fs.readFile(
      filePath,
      "utf8"
    );

    const count =
      await ingestKnowledgeDocument(
        file,
        content
      );

    console.log(
      `Ingested ${file}: ${count} chunks`
    );
  }

  console.log("RAG ingestion completed");
};

run().catch((error) => {
  console.error(
    "RAG ingestion failed:",
    error
  );
  process.exit(1);
});