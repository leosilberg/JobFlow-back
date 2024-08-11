import { Router } from "express";
import { generateJobRecomendations } from "../controllers/openai.controller.ts";

const router = Router();

router.get("/job-recomendation", generateJobRecomendations);

export default router;
