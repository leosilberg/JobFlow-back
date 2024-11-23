import bcrypt from "bcrypt";
import type { Response } from "express";
import jwt, { type Secret } from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/user.model";
import { UserSchema } from "../schemas/user.schema";
import { TypedRequest } from "../types/express.types";
import { errorResponse, successResponse } from "../utils/response.utils";

const { JWT_SECRET } = process.env;

export const RegisterSchema = {
  body: UserSchema,
};
export async function register(
  req: TypedRequest<typeof RegisterSchema>,
  res: Response,
) {
  try {
    const { email, password, firstName, lastName } = req.body;
    const newUser = new User({
      email,
      password,
      firstName,
      lastName,
    });
    await newUser.save();
    return successResponse(res, {}, 201, "User registed succesfully");
  } catch (error) {
    if (
      error instanceof mongoose.mongo.MongoServerError &&
      error.code === 11000
    ) {
      req.log.error(`auth.controller: `, error);
      return errorResponse(res, 400, "User already exists");
    }
    throw error;
  }
}

export const LoginSchema = {
  body: UserSchema.pick({ email: true, password: true }),
};
export async function login(
  req: TypedRequest<typeof LoginSchema>,
  res: Response,
) {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (!user) {
    req.log.warn(`auth.controller: user not found`);
    return errorResponse(res, 401, "Email or password are incorrect");
  }

  const isPasswordMatch = await bcrypt.compare(password, user.password);

  if (!isPasswordMatch) {
    req.log.warn(`auth.controller: password incorrect`);
    return errorResponse(res, 401, "Email or password are incorrect");
  }

  const { _id } = user.toJSON();

  const token = jwt.sign({ _id }, JWT_SECRET as Secret, { expiresIn: "1d" });
  return successResponse(res, token);
}
