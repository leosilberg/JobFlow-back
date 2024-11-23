import { Response } from "express";
import path from "path";
import { z } from "zod";
import { TypedRequest } from "../types/express.types";
import { runPythonScript } from "../utils/python.utils";
import { successResponse } from "../utils/response.utils";

export const GetLinkedInJobsList = {
  query: z.object({ keywords: z.string(), location: z.string() }),
};
export async function getLinkedInJobsList(
  req: TypedRequest<typeof GetLinkedInJobsList>,
  res: Response,
): Promise<void> {
  const commandLineArgs = [];
  for (const [key, value] of Object.entries(req.query)) {
    commandLineArgs.push(`--${key}`);
    commandLineArgs.push(value as string);
  }

  const pyScraper = path.join(
    path.resolve(__dirname, ".."),
    "python",
    "linkedin_scraper.py",
  );

  const data = await runPythonScript(pyScraper, ["list", ...commandLineArgs]);
  const jobs = JSON.parse(data);
  return successResponse(res, jobs);
}

export const GetLinkedInJobDetails = {
  params: z.object({ jobId: z.string() }),
};
export async function getLinkedInJobDetails(
  req: TypedRequest<typeof GetLinkedInJobDetails>,
  res: Response,
): Promise<void> {
  const { jobId } = req.params;

  const pyScraper = path.join(
    path.resolve(__dirname, ".."),
    "python",
    "linkedin_scraper.py",
  );

  const data = await runPythonScript(pyScraper, ["details", jobId]);
  const details = JSON.parse(data);
  return successResponse(res, details);
}
