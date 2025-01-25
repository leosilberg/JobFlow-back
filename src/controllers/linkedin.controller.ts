import { Response } from "express";
import { z } from "zod";
import { TypedRequest } from "../types/express.types";
import { errorResponse, successResponse } from "../utils/response.utils";

export const GetLinkedInJobsList = {
  query: z.object({
    keywords: z.string(),
    location: z.string(),
    date_since_posted: z.string(),
    sort_by: z.string(),
    start: z.string(),
  }),
};
export async function getLinkedInJobsList(
  req: TypedRequest<typeof GetLinkedInJobsList>,
  res: Response,
): Promise<void> {
  const { keywords, location, date_since_posted, sort_by, start } = req.query;

  const response = await fetch(
    `http://quart:5000/api/scraper/linkedin/list?keywords=${keywords}&location=${location}&date_since_posted=${date_since_posted}&start=${start}&sort_by=${sort_by}`,
  );

  if (response.status !== 200) {
    return errorResponse(res, 400, "Error fetching LinkedIn jobs");
  }

  const data = await response.json();
  return successResponse(res, data);
}

export const GetLinkedInJobDetails = {
  params: z.object({ jobId: z.string() }),
};
export async function getLinkedInJobDetails(
  req: TypedRequest<typeof GetLinkedInJobDetails>,
  res: Response,
): Promise<void> {
  const { jobId } = req.params;

  const response = await fetch(
    `http://quart:5000/api/scraper/linkedin/details/${jobId}`,
  );

  if (response.status !== 200) {
    return errorResponse(res, 400, "Error fetching LinkedIn job details");
  }

  const data = await response.json();
  return successResponse(res, data);
}
