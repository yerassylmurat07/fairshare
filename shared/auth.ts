import { z } from "zod";

export const MIN_PASSWORD_LENGTH = 15;
export const MAX_PASSWORD_LENGTH = 128;
export const newPasswordSchema = z
  .string()
  .min(
    MIN_PASSWORD_LENGTH,
    "Используйте минимум 15 символов — например, несколько слов.",
  )
  .max(MAX_PASSWORD_LENGTH, "Пароль не должен превышать 128 символов.");
export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("Введите корректный email.")
    .max(200, "Email слишком длинный.")
    .transform((v) => v.toLowerCase()),
  // Existing accounts must remain usable when the registration policy changes.
  password: z
    .string()
    .min(1, "Введите пароль.")
    .max(MAX_PASSWORD_LENGTH, "Пароль не должен превышать 128 символов."),
});
export const registerSchema = loginSchema
  .extend({
    name: z
      .string()
      .trim()
      .min(2, "Введите имя: минимум 2 символа.")
      .max(80, "Имя не должно превышать 80 символов."),
    teamName: z
      .string()
      .trim()
      .min(2, "Введите название команды: минимум 2 символа.")
      .max(80, "Название не должно превышать 80 символов.")
      .optional(),
    inviteToken: z
      .string()
      .min(30, "Некорректное приглашение.")
      .max(100, "Некорректное приглашение.")
      .optional(),
    password: newPasswordSchema,
  })
  .superRefine((data, ctx) => {
    if (!data.inviteToken && !data.teamName)
      ctx.addIssue({
        code: "custom",
        path: ["teamName"],
        message: "Введите название команды.",
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
        message: "Пароли не совпадают.",
      });
    if (data.newPassword === data.currentPassword)
      ctx.addIssue({
        code: "custom",
        path: ["newPassword"],
        message: "Новый пароль должен отличаться от текущего.",
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
