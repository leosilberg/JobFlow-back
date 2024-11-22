import { z } from "zod";
// extendZod(z);

export const JobSchema = z.object({
  userId: z.string(), //zId("User"),
  position: z.string(),
  company: z.string(),
  company_logo: z.string().optional(),
  location: z.string(),
  description: z.string(),
  salary: z.string().optional(),
  link: z.string().url(),
  status: z.number().int().min(0),
  order: z.number().int().min(0),
  custom_resume_link: z.string().url().optional(),
  interview_date: z.string().optional(),
  contract_link: z.string().optional(),
});

export type Job = z.infer<typeof JobSchema>;
