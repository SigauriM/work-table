import { z } from "zod";
import { LOGIN_MAX, PASSWORD_MAX, PASSWORD_SET_MIN } from "../../core/stringFields.js";

export const loginSchema = z.object({
  login: z.string().min(1).max(LOGIN_MAX),
  password: z.string().min(1).max(PASSWORD_MAX),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(PASSWORD_MAX),
  newPassword: z.string().min(PASSWORD_SET_MIN).max(PASSWORD_MAX),
});
