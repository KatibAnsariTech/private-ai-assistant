import express from "express";
import { askAi } from "../controllers/aiController.js";

const router = express.Router();

router.post("/ask", askAi);

export default router;
