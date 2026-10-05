import { Router } from "express";
import { askAI } from "../controllers/ai.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.post("/ask", askAI);

export default router;