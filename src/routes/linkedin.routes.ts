import { Router } from "express";
import getJobs from "../controllers/linkedin.controller";

const router = Router();

router.get("/", getJobs);

export default router;
