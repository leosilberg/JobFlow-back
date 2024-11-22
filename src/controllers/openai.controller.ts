import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import axios from "axios";
import { Response } from "express";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";
import { logger } from "../libs/logger";
import User from "../models/user.model";
import { TypedRequest } from "../types/express.types";
import { saveToTempFile } from "../utils/file.utils";
import { runPythonScript } from "../utils/python.utils";
import { errorResponse, successResponse } from "../utils/response.utils";

export const GenerateJobRecomendationsSchema = {};
export async function generateJobRecomendations(
  req: TypedRequest<typeof GenerateJobRecomendationsSchema>,
  res: Response
) {
  const userId = req.userId;

  const user = await User.findById(userId);
  if (!user) {
    req.log.warn(`user.controller: Not found `, userId);
    return errorResponse(res, 401, "No user found");
  }

  if (!user.resume_link) {
    req.log.warn(`user.controller: Not found resume`, userId);
    return errorResponse(res, 401, "No resume found");
  }

  const { data } = await axios.get(user.resume_link, {
    responseType: "arraybuffer",
  });

  const file = await saveToTempFile(
    `file_${Date.now()}.docx`,
    Buffer.from(data)
  );

  const pyRead = path.join(
    path.resolve(__dirname, ".."),
    "python",
    "docx_read.py"
  );

  const text = await runPythonScript(pyRead, [file]);
  fs.unlink(file);

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
    prompt: `Generate 5 jobs for the following resume ${text}`,
  });
  return successResponse(res, result.object.jobs);
}

export const GenerateJobMatcherSchema = {
  body: z.object({
    description: z.string(),
  }),
};
export async function generateJobMatcher(
  req: TypedRequest<typeof GenerateJobMatcherSchema>,
  res: Response
) {
  const { description } = req.body;
  const userId = req.userId;

  const user = await User.findById(userId);
  if (!user) {
    req.log.warn(`user.controller: Not found `, userId);
    return errorResponse(res, 401, "No user found");
  }

  if (!user.resume_link) {
    req.log.warn(`user.controller: Not found resume`, userId);
    return errorResponse(res, 401, "No resume found");
  }

  const { data } = await axios.get(user.resume_link, {
    responseType: "arraybuffer", // Important to set response type to arraybuffer
  });

  const file = await saveToTempFile(
    `file_${Date.now()}.docx`,
    Buffer.from(data)
  );

  const pyRead = path.join(
    path.resolve(__dirname, ".."),
    "python",
    "docx_read.py"
  );

  const text = await runPythonScript(pyRead, [file]);

  const result = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: z.object({
      changes: z.array(
        z.object({
          originalText: z.string(),
          newText: z.string(),
        })
      ),
    }),
    system:
      "You are an AI assistant specialized in resume analysis and job matching. Your primary function is to read and understand the content of job resume, identify key skills, experiences, and qualifications, and recommend suitable job roles or career paths based on this information. You will improve the current text you recieve to match the job description and return which original text needs to be replaced with new.Try to improve each sentance in accordance with the description provided. Provide each complete sentence to be replaced and not more than one sentence each time",
    prompt: `Generate for the following resume ${text} using the following job description ${description}`,
  });

  logger.debug(`openai.controller: `, result.object.changes);
  const pyReplace = path.join(
    path.resolve(__dirname, ".."),
    "python",
    "docx_replace.py"
  );
  const args = [file, JSON.stringify(result.object.changes)];

  await runPythonScript(pyReplace, args);
  return res
    .status(200)
    .sendFile(`${file.replace(".docx", "_new.docx")}`, (error) => {
      fs.unlink(file);
      fs.unlink(file.replace(".docx", "_new.docx"));
    });
}
