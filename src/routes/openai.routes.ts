import { Router } from "express";
import {
  generateJobMatcher,
  generateJobRecomendations,
} from "../controllers/openai.controller.ts";

const router = Router();

router.get("/job-recomendation", generateJobRecomendations);
router.post("/job-matcher", generateJobMatcher);

export default router;
