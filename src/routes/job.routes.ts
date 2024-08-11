import { Router } from "express";
import {
  createJob,
  deleteJob,
  editJob,
  getJob,
  getJobs,
} from "../controllers/job.controller.ts";

const router = Router();

router.get("/", getJobs);
router.get("/:jobId", getJob);
router.post("/", createJob);
router.patch("/:jobId", editJob);
router.delete("/:jobId", deleteJob);

export default router;
