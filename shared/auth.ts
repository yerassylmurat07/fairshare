import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 15;
export const MAX_PASSWORD_LENGTH = 128;
export const newPasswordSchema = z
  .string()
  .min(
    MIN_PASSWORD_LENGTH,
    "Use at least 15 characters, for example a few words.",
  )
  .max(MAX_PASSWORD_LENGTH, "The password must be at most 128 characters.");
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Enter a valid email.")
    .max(200, "The email is too long.")
    .transform((v) => v.toLowerCase()),
  // Existing accounts must remain usable when the registration policy changes.
  password: z
    .string()
    .min(1, "Enter your password.")
    .max(MAX_PASSWORD_LENGTH, "The password must be at most 128 characters."),
});
export const registerSchema = loginSchema
  .extend({
    name: z
      .string()
      .trim()
      .min(2, "Enter your name: at least 2 characters.")
      .max(80, "The name must be at most 80 characters."),
    teamName: z
      .string()
      .trim()
      .min(2, "Enter a team name: at least 2 characters.")
      .max(80, "The name must be at most 80 characters.")
      .optional(),
    inviteToken: z
      .string()
      .min(30, "Invalid invitation.")
      .max(100, "Invalid invitation.")
      .optional(),
    password: newPasswordSchema,
  })
  .superRefine((data, ctx) => {
    if (!data.inviteToken && !data.teamName)
      ctx.addIssue({
        code: "custom",
        path: ["teamName"],
        message: "Enter a team name.",
      });
  });

export const changePasswordSchema = z
  .object({
    currentPassword: loginSchema.shape.password,
    newPassword: newPasswordSchema,
    confirmPassword: loginSchema.shape.password,
  })
  .superRefine((data, ctx) => {
    if (data.newPassword !== data.confirmPassword)
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "The passwords do not match.",
      });
    if (data.newPassword === data.currentPassword)
      ctx.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "The new password must differ from the current one.",
      });
  });

export function authFieldErrors(
  issues: { path: PropertyKey[]; message: string }[],
) {
  const fields: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (!Object.hasOwn(fields, key)) fields[key] = issue.message;
  }
  return fields;
}
