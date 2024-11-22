import type { Response } from "express";

export function successResponse(
  res: Response,
  data?: any,
  status: number = 200,
  message: string = "Success"
) {
  return void res.status(status).json({ message, data });
}

export function errorResponse(
  res: Response,
  status: number,
  message: string,
  error?: any
) {
  return void res.status(status).json({ message, error });
}
