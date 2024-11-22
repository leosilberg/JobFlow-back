import { Router } from "express";
import validate from "express-zod-safe";
import {
  GetLinkedInJobDetails,
  getLinkedInJobDetails,
  GetLinkedInJobsList,
  getLinkedInJobsList,
} from "../controllers/linkedin.controller";
import { validateErrorHandler } from "../middleware/error.middleware";

const router = Router();

router.get(
  "/list",
  validate({ handler: validateErrorHandler, ...GetLinkedInJobsList }),
  getLinkedInJobsList
);
router.get(
  "/job/:jobId",
  validate({ handler: validateErrorHandler, ...GetLinkedInJobDetails }),
  getLinkedInJobDetails
);

export default router;
