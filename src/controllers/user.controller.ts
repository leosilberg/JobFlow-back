import type { Response } from "express";
import User from "../models/user.model";
import { UserSchema } from "../schemas/user.schema";
import { TypedRequest } from "../types/express.types";
import { errorResponse, successResponse } from "../utils/response.utils";

export const GetUserSchema = {};
export async function getUser(
  req: TypedRequest<typeof GetUserSchema>,
  res: Response,
) {
  const userId = req.userId;

  const user = await User.findById(userId);
  if (!user) {
    req.log.warn(`user.controller: Not found`, userId);
    return errorResponse(res, 401, "No user found");
  }

  const { password, ...userWithoutPassword } = user.toJSON();

  return successResponse(res, { ...userWithoutPassword });
}

export const EditUserSchema = {
  body: UserSchema.partial(),
};
export async function editUser(
  req: TypedRequest<typeof EditUserSchema>,
  res: Response,
) {
  const userId = req.userId;
  const { resume_link } = req.body;
  try {
    const user = await User.findById(userId);

    if (!user) {
      req.log.warn(`user.controller: Not found`, userId);
      return errorResponse(res, 401, "User not found");
    }

    user.resume_link = resume_link;

    user.save();
    return successResponse(res, {}, 200, "User details changed");
  } catch (error) {
    if ((error as Error).name === "ValidationError") {
      req.log.error(`user.controller: `, error);
      return errorResponse(res, 400, (error as Error).message);
    }
    throw error;
  }
}

export const DeleteUserSchema = {};
export async function deleteUser(
  req: TypedRequest<typeof DeleteUserSchema>,
  res: Response,
) {
  const userId = req.userId;

  const deletedUser = await User.findOneAndDelete({
    _id: userId,
  });

  if (!deletedUser) {
    req.log.warn(`user.controller: not found`, userId);
    return errorResponse(res, 404, "No user found");
  }

  return successResponse(res, {}, 200, "User deleted succesfuly");
}
