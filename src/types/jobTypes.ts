import type { Document, Types } from "mongoose";

export interface IJob extends Document {
  userId: Types.ObjectId;
  title: string;
  company: string;
  location: string;
  description: string;
  salary?: string;
  link: string;
  status: number;
  order: number;
  custom_resume_link?: string;
  interview_date?: string;
  contract_link?: string;
}
