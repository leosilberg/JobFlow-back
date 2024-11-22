import { Router } from "express";
import validate from "express-zod-safe";
import {
  createJob,
  CreateJobSchema,
  deleteJob,
  DeleteJobSchema,
  editJob,
  EditJobSchema,
  getJob,
  getJobs,
  GetJobSchema,
  GetJobsSchema,
  updateJobOrders,
  UpdateJobOrdersSchema,
} from "../controllers/job.controller";
import { validateErrorHandler } from "../middleware/error.middleware";

const router = Router();

router.get(
  "/",
  validate({ handler: validateErrorHandler, ...GetJobsSchema }),
  getJobs
);
router.get(
  "/:jobId",
  validate({ handler: validateErrorHandler, ...GetJobSchema }),
  getJob
);
router.post(
  "/",
  validate({ handler: validateErrorHandler, ...CreateJobSchema }),
  createJob
);
router.patch(
  "/order",
  validate({ handler: validateErrorHandler, ...UpdateJobOrdersSchema }),
  updateJobOrders
);
router.patch(
  "/:jobId",
  validate({ handler: validateErrorHandler, ...EditJobSchema }),
  editJob
);
router.delete(
  "/:jobId",
  validate({ handler: validateErrorHandler, ...DeleteJobSchema }),
  deleteJob
);

export default router;
