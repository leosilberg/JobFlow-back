import type { Response } from "express";
import { z } from "zod";
import Job from "../models/job.model";
import { JobSchema } from "../schemas/job.schema";
import { TypedRequest } from "../types/express.types";
import { IJob } from "../types/jobTypes";
import { errorResponse, successResponse } from "../utils/response.utils";

export const GetJobsSchema = {};
export async function getJobs(
  req: TypedRequest<typeof GetJobSchema>,
  res: Response
) {
  const userId = req.userId;

  const jobs = await Job.find({ userId: userId }).sort({
    status: 1,
    order: 1,
  });

  const sortedJobs = jobs.reduce<IJob[][]>((acc, job) => {
    if (!acc[job.status]) {
      acc[job.status] = [];
    }
    acc[job.status].push(job);
    return acc;
  }, []);

  return successResponse(res, sortedJobs);
}

export const GetJobSchema = {
  params: z.object({
    jobId: z.string(),
  }),
};
export async function getJob(
  req: TypedRequest<typeof GetJobSchema>,
  res: Response
) {
  const { jobId } = req.params;

  const job = await Job.findById(jobId);
  if (!job) {
    req.log.warn(`job.controller: Not found `, jobId);
    return errorResponse(res, 401, "No job found");
  }

  return successResponse(res, job);
}

export const CreateJobSchema = {
  body: JobSchema.omit({ userId: true, order: true }),
};
export async function createJob(
  req: TypedRequest<typeof CreateJobSchema>,
  res: Response
) {
  const userId = req.userId;
  try {
    const newJob = new Job({ ...req.body, userId });
    const savedJob = await newJob.save();
    return successResponse(res, savedJob, 201, "Job created");
  } catch (error) {
    if ((error as Error).name === "ValidationError") {
      req.log.error(`job.controller: `, error);
      return errorResponse(res, 400, (error as Error).message);
    }
    throw error;
  }
}

export const EditJobSchema = {
  params: z.object({ jobId: z.string() }),
  body: JobSchema.omit({ userId: true }).partial(),
};
export async function editJob(
  req: TypedRequest<typeof EditJobSchema>,
  res: Response
) {
  const { jobId } = req.params;
  try {
    const updatedJob = await Job.findOneAndUpdate(
      { _id: jobId },
      { ...req.body },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!updatedJob) {
      req.log.warn(`job.controller: Not found `, jobId);
      return errorResponse(res, 401, "No job found");
    }

    return successResponse(res, updatedJob);
  } catch (error) {
    if ((error as Error).name === "ValidationError") {
      req.log.error(`job.controller: `, error);
      return errorResponse(res, 400, (error as Error).message);
    }
    throw error;
  }
}

export const UpdateJobOrdersSchema = {
  body: z.object({
    jobs: z.array(
      z.object({
        _id: z.string(),
        changes: z.object({
          order: z.number().int().min(0),
          status: z.number().int().min(0),
        }),
      })
    ),
  }),
};
export async function updateJobOrders(
  req: TypedRequest<typeof UpdateJobOrdersSchema>,
  res: Response
) {
  try {
    const bulkOps = req.body.jobs.map((obj) => {
      const ops = {
        updateOne: {
          filter: {
            _id: obj._id,
          },
          update: {
            order: obj.changes.order,
            status: obj.changes.status,
          },
        },
      };
      return ops;
    });
    const updatedJobs = await Job.bulkWrite(bulkOps);
    if (!updatedJobs) {
      req.log.warn(`job.controller: Bulk jobs Not found `);
      return errorResponse(res, 401, "No jobs found");
    }

    return successResponse(res, {});
  } catch (error) {
    if ((error as Error).name === "ValidationError") {
      req.log.error(`job.controller: `, error);
      return errorResponse(res, 400, (error as Error).message);
    }
    throw error;
  }
}

export const DeleteJobSchema = {
  params: z.object({
    jobId: z.string(),
  }),
};
export async function deleteJob(
  req: TypedRequest<typeof DeleteJobSchema>,
  res: Response
) {
  const { jobId } = req.params;

  const deletedJob = await Job.findOneAndDelete({
    _id: jobId,
  });

  if (!deletedJob) {
    req.log.warn(`job.controller: Not found `, jobId);
    return errorResponse(res, 401, "No job found");
  }

  return successResponse(res, {}, 200, "Job deleted succesfuly");
}
