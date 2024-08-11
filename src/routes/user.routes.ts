import { Router } from "express";
import {
  deleteUser,
  editUser,
  getUser,
} from "../controllers/user.controller.ts";

const router = Router();

router.get("/", getUser);
router.patch("/", editUser);
router.delete("/", deleteUser);

export default router;
