import { z } from "zod";
// extendZod(z);

export const UserSchema = z.object({
  email: z.string(), //.unique(),
  password: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  resume_link: z.string().optional(),
});

export type User = z.infer<typeof UserSchema>;
