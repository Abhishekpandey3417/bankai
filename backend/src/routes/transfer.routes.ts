import { Router } from "express";

import {
    createTransfer,
} from "../controllers/transfer.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.post("/", createTransfer);

export default router;