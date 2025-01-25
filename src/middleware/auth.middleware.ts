import type { NextFunction, Request, Response } from "express";
import type { Secret } from "jsonwebtoken";
import jwt, { TokenExpiredError } from "jsonwebtoken";
import type { UserJwtPaylod } from "../types/authTypes";
import { errorResponse } from "../utils/response.utils";
const { JWT_SECRET } = process.env;

export function verifyToken(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader =
      req.header("Authorization") || req.header("authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      req.log.warn(`auth.middleware: no token provided`);
      return errorResponse(res, 401, "Access denied");
    }
    const decoded = jwt.verify(token, JWT_SECRET as Secret) as UserJwtPaylod;
    req.userId = decoded._id;
    next();
  } catch (error) {
    req.log.error(error);
    if (error instanceof TokenExpiredError) {
      return errorResponse(res, 401, "Token expired");
    }
    return errorResponse(res, 401, "Invalid token");
  }
}
