import { Router } from "express";

import {
    createAccount,
    getAccounts,
    getAccountById,
    updateAccount,
    deleteAccount,
} from "../controllers/account.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.post("/", createAccount);
router.get("/", getAccounts);
router.get("/:id", getAccountById);
router.put("/:id", updateAccount);
router.delete("/:id", deleteAccount);

export default router;