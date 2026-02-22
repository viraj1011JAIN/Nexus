import { z } from "zod";
import { TenantError } from "@/lib/tenant-context";

export type FieldErrors<T> = {
  [K in keyof T]?: string[];
};

export type ActionState<TInput, TOutput> = {
  fieldErrors?: FieldErrors<TInput>;
  error?: string | null;
  data?: TOutput;
};

// Generic messages — never expose internal IDs, entity names, or org details to the client.
const TENANT_ERROR_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "You must be signed in to perform this action.",
  FORBIDDEN: "You do not have permission to perform this action.",
  NOT_FOUND: "The requested resource was not found.",
};

export const createSafeAction = <TInput, TOutput>(
  schema: z.Schema<TInput>,
  handler: (validatedData: TInput) => Promise<ActionState<TInput, TOutput>>
) => {
  return async (data: TInput): Promise<ActionState<TInput, TOutput>> => {
    const validationResult = schema.safeParse(data);

    if (!validationResult.success) {
      return {
        fieldErrors: validationResult.error.flatten().fieldErrors as FieldErrors<TInput>,
      };
    }

    try {
      return await handler(validationResult.data);
    } catch (err) {
      // Map TenantErrors to safe, generic client messages.
      // Never leak internal IDs, org names, or entity details.
      if (err instanceof TenantError) {
        return {
          error: TENANT_ERROR_MESSAGES[err.code] ?? "Something went wrong.",
        };
      }
      throw err; // Re-throw unexpected errors — let Next.js error boundary handle them.
    }
  };
};