import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { errorResponse } from "../utils/response.utils";

export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.log.error(err);
  return errorResponse(res, 500, "Server error");
}

export function validateErrorHandler(
  errors: {
    type: string;
    errors: ZodError<any>;
  }[],
  req: Request,
  res: Response,
  next: NextFunction,
) {
  req.log.error(errors);
  return errorResponse(res, 400, "Invalid request", errors);
}
