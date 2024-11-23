import { Router } from "express";
import validate from "express-zod-safe";
import {
  deleteUser,
  DeleteUserSchema,
  editUser,
  EditUserSchema,
  getUser,
  GetUserSchema,
} from "../controllers/user.controller";
import { validateErrorHandler } from "../middleware/error.middleware";

const router = Router();

router.get(
  "/",
  validate({ handler: validateErrorHandler, ...GetUserSchema }),
  getUser,
);
router.patch(
  "/",
  validate({ handler: validateErrorHandler, ...EditUserSchema }),
  editUser,
);
router.delete(
  "/",
  validate({ handler: validateErrorHandler, ...DeleteUserSchema }),
  deleteUser,
);

export default router;
