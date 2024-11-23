import { Request } from "express";
import { ZodType, ZodTypeDef, z } from "zod";

export type TypedRequest<
  T extends Partial<
    Record<"params" | "query" | "body", ZodType<any, ZodTypeDef, any>>
  >,
> = Request<
  T["params"] extends ZodType<any, ZodTypeDef, any> ? z.infer<T["params"]> : {},
  any,
  T["body"] extends ZodType<any, ZodTypeDef, any> ? z.infer<T["body"]> : {},
  T["query"] extends ZodType<any, ZodTypeDef, any> ? z.infer<T["query"]> : {}
>;
