import { Router } from "express";

import {
    createCard,
    getCards,
    getCardById,
    updateCard,
    deleteCard,
} from "../controllers/card.controller.js";

import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.post("/", createCard);

router.get("/", getCards);

router.get("/:id", getCardById);

router.put("/:id", updateCard);

router.delete("/:id", deleteCard);

export default router;