import { Router } from "express";

import {
    createTransaction,
    getTransactions,
    getTransactionById,
    updateTransaction,
    deleteTransaction,
} from "../controllers/transaction.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.post("/", createTransaction);

router.get("/", getTransactions);

router.get("/:id", getTransactionById);

router.put("/:id", updateTransaction);

router.delete("/:id", deleteTransaction);

export default router;