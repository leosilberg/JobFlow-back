import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import axios from "axios";
import { Request, Response } from "express";
import mammoth from "mammoth";
import { z } from "zod";
import User from "../models/user.model.ts";
import { AuthRequest } from "../types/authTypes.ts";

export async function generateJobRecomendations(req: Request, res: Response) {
  const userId = (req as AuthRequest).userId;
  try {
    const user = await User.findById(userId);
    if (!user) {
      console.log(`user.controller: Not found `, userId);
      return res.status(401).json("No user found");
    }

    if (!user.resume_link) {
      return res.status(401).json("No resume found");
    }

    const response = await axios.get(user.resume_link, {
      responseType: "arraybuffer", // Important to set response type to arraybuffer
    });

    // The data is now in a buffer
    const buffer = Buffer.from(response.data);
    const resumeText = await mammoth.extractRawText({ buffer });
    console.log(`openai.controller: `, resumeText.value);
    const result = await generateObject({
      model: openai("gpt-4o-mini"),
      schema: z.object({
        jobs: z.array(
          z.object({
            title: z.string(),
            description: z.string(),
          })
        ),
      }),
      system:
        "You are an AI assistant specialized in resume analysis and job matching. Your primary function is to read and understand the content of resumes, identify key skills, experiences, and qualifications, and recommend suitable job roles or career paths based on this information.",
      prompt: `Generate 5 jobs for the following resume ${resumeText.value}`,
    });
    res.status(200).json(result.object.jobs);
  } catch (error) {
    console.log(`openai.controller: `, error);
    res.status(500).json("Error occured on the server");
  }
}
