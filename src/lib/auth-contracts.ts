import { z } from "zod";
const password = z
  .string()
  .refine((v) => Array.from(v).length >= 12, "Use pelo menos 12 caracteres.")
  .refine(
    (v) => new TextEncoder().encode(v).length <= 72,
    "A senha deve ter no máximo 72 bytes.",
  );
const confirm = { password, password_confirmation: z.string() };
const match = (v: { password: string; password_confirmation: string }) =>
  v.password === v.password_confirmation;
export const authSchemas = {
  register: z
    .object({
      name: z.string().trim().min(1).max(120),
      email: z.email(),
      ...confirm,
    })
    .strict()
    .refine(match, {
      message: "As senhas não coincidem.",
      path: ["password_confirmation"],
    }),
  login: z
    .object({ email: z.email(), password: z.string().min(1).max(500) })
    .strict(),
  verify: z.object({ token: z.string().min(1).max(4096) }).strict(),
  forgot: z.object({ email: z.email() }).strict(),
  reset: z
    .object({ token: z.string().min(1).max(4096), ...confirm })
    .strict()
    .refine(match, {
      message: "As senhas não coincidem.",
      path: ["password_confirmation"],
    }),
  profile: z.object({ name: z.string().trim().min(1).max(120) }).strict(),
  delete: z.object({ password: z.string().min(1).max(500) }).strict(),
  logout: z.object({}).strict(),
  rotate: z.object({}).strict(),
};
export type AuthAction = keyof typeof authSchemas;
export const authPaths: Record<AuthAction, string> = {
  register: "/auth/register",
  login: "/auth/login",
  verify: "/auth/verify",
  forgot: "/auth/password/forgot",
  reset: "/auth/password/reset",
  profile: "/users/me",
  delete: "/users/me",
  logout: "/auth/logout",
  rotate: "/auth/rotate",
};
export const authMethods: Partial<Record<AuthAction, string>> = {
  profile: "PATCH",
  delete: "DELETE",
};
