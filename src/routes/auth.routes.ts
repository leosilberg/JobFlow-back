import { Router } from "express";
import validate from "express-zod-safe";
import {
  login,
  LoginSchema,
  register,
  RegisterSchema,
} from "../controllers/auth.controller";
import { validateErrorHandler } from "../middleware/error.middleware";

const router = Router();

router.post(
  "/login",
  validate({ handler: validateErrorHandler, ...LoginSchema }),
  login
);
router.post(
  "/register",
  validate({ handler: validateErrorHandler, ...RegisterSchema }),
  register
);
export default router;
