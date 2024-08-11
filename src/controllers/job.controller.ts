import type { Request, Response } from "express";
import Job from "../models/job.model.ts";
import { AuthRequest } from "../types/authTypes.ts";

export async function getJobs(req: Request, res: Response) {
  const userId = (req as AuthRequest).userId;
  try {
    const jobs = await Job.find({ userId: userId });
    res.status(200).json(jobs);
  } catch (error) {
    console.log(`job.controller: `, (error as Error).message);
    res.status(500).json("Server error getting all jobs");
  }
}

export async function getJob(req: Request, res: Response) {
  const { jobId } = req.params;
  try {
    const job = await Job.findById(jobId);
    if (!job) {
      console.log(`job.controller: Not found `, jobId);
      return res.status(401).json("No job found");
    }

    res.status(200).json(job);
  } catch (error) {
    console.log(`job.controller: `, (error as Error).message);
    res.status(500).json("Server error getting job");
  }
}

export async function createJob(req: Request, res: Response) {
  const userId = (req as AuthRequest).userId;
  try {
    const newJob = new Job({ ...req.body, userId });
    const savedJob = await newJob.save();
    res.status(201).json(savedJob);
  } catch (error) {
    error as Error;
    console.log(`job.controller: `, (error as Error).message);
    if ((error as Error).name === "ValidationError") {
      res.status(400).json((error as Error).message);
    } else {
      res.status(500).json("Server error while creating job");
    }
  }
}

export async function editJob(req: Request, res: Response) {
  const { jobId } = req.params;
  console.log(`job.controller: `, req.body);
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
      console.log(`job.controller: Not found `, jobId);
      return res.status(401).json("No job found");
    }

    res.status(200).json(updatedJob);
  } catch (error) {
    console.log(`job.controller: `, (error as Error).message);
    if ((error as Error).name === "ValidationError") {
      res.status(400).json((error as Error).message);
    } else {
      res.status(500).json({ message: "Server error while updating job" });
    }
  }
}

export async function deleteJob(req: Request, res: Response) {
  const { jobId } = req.params;
  try {
    const deletedJob = await Job.findOneAndDelete({
      _id: jobId,
    });

    if (!deletedJob) {
      console.log(`job.controller: Not found `, jobId);
      res.status(404).json("No job found");
    }
    res.status(200).json("Job deleted succesfuly");
  } catch (error) {
    console.log(`job.controller: `, (error as Error).message);
    res.status(500).json("Server error deleting job");
  }
}
