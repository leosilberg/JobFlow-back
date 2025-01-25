import { Router } from "express";
import validate from "express-zod-safe";
import {
  generateJobMatcher,
  GenerateJobMatcherSchema,
  generateJobRecomendations,
  GenerateJobRecomendationsSchema,
} from "../controllers/openai.controller";
import { validateErrorHandler } from "../middleware/error.middleware";

const router = Router();

router.get(
  "/recommend",
  validate({
    handler: validateErrorHandler,
    ...GenerateJobRecomendationsSchema,
  }),
  generateJobRecomendations,
);
router.post(
  "/matcher",
  validate({ handler: validateErrorHandler, ...GenerateJobMatcherSchema }),
  generateJobMatcher,
);

export default router;
