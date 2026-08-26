import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { HttpError } from "../../middleware/errorHandler.js";
import { Role } from "@prisma/client";

const AUTH_FAILED = "Invalid credentials";
const BCRYPT_ROUNDS = 10;

function parseRefreshToken(raw: string): { id: string; secret: string } {
  const dot = raw.indexOf(".");
  if (dot <= 0 || dot === raw.length - 1) {
    throw new HttpError(401, AUTH_FAILED);
  }
  return { id: raw.slice(0, dot), secret: raw.slice(dot + 1) };
}

async function issueRefreshToken(userId: string): Promise<string> {
  const secret = randomBytes(32).toString("hex");
  const tokenHash = await bcrypt.hash(secret, BCRYPT_ROUNDS);
  const expiresAt = new Date(
    Date.now() + env.jwtRefreshDays * 24 * 60 * 60 * 1000,
  );
  const row = await prisma.refreshToken.create({
    data: { userId, tokenHash, expiresAt },
  });
  return `${row.id}.${secret}`;
}

function issueAccessToken(user: {
  id: string;
  role: "ADMIN" | "EMPLOYEE";
  employee: { id: string } | null;
}): string {
  const options: SignOptions = {
    subject: user.id,
    expiresIn: env.jwtAccessExpires as SignOptions["expiresIn"],
  };
  return jwt.sign(
    {
      role: user.role,
      employeeId: user.employee?.id ?? null,
    },
    env.jwtAccessSecret,
    options,
  );
}

function toPublicUser(user: {
  id: string;
  login: string;
  role: "ADMIN" | "EMPLOYEE";
  employee: { id: string } | null;
}) {
  return {
    id: user.id,
    login: user.login,
    role: user.role,
    employeeId: user.employee?.id ?? null,
  };
}

const userWithEmployee = { employee: true } as const;

function assertEmployeeActive(user: {
  role: "ADMIN" | "EMPLOYEE";
  employee: { isActive: boolean } | null;
}) {
  if (user.role === Role.EMPLOYEE && (!user.employee || !user.employee.isActive)) {
    throw new HttpError(401, AUTH_FAILED);
  }
}

export async function login(loginName: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { login: loginName },
    include: userWithEmployee,
  });
  const passwordHash = user?.passwordHash ?? (await bcrypt.hash("dummy", BCRYPT_ROUNDS));
  const matches = await bcrypt.compare(password, passwordHash);
  if (!user || !matches) {
    throw new HttpError(401, AUTH_FAILED);
  }
  assertEmployeeActive(user);
  const accessToken = issueAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);
  return { accessToken, refreshToken, user: toPublicUser(user) };
}

async function verifyRefreshToken(raw: string) {
  const { id, secret } = parseRefreshToken(raw);
  const row = await prisma.refreshToken.findUnique({ where: { id } });
  const tokenHash = row?.tokenHash ?? (await bcrypt.hash("dummy", BCRYPT_ROUNDS));
  const matches = await bcrypt.compare(secret, tokenHash);
  if (
    !row ||
    !matches ||
    row.revokedAt ||
    row.expiresAt.getTime() <= Date.now()
  ) {
    throw new HttpError(401, AUTH_FAILED);
  }
  return row;
}

async function consumeRefreshToken(raw: string) {
  const row = await verifyRefreshToken(raw);
  await prisma.refreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });
  return row.userId;
}

/**
 * v1 does **not** rotate refresh tokens (Stage 3 did; that was dropped).
 *
 * Verifies the existing refresh row and returns a new access token plus the
 * same refresh string. Does not revoke this row. Revoke is logout / deactivate.
 *
 * Rotation was removed because F5 during the response stored the old token in
 * the browser after the server had already consumed the new one. See
 * LIMITATIONS.md. If rotation is restored, re-test PWA auto-update: old and new
 * shells must not race-consume the refresh token.
 */
export async function refresh(rawRefreshToken: string) {
  const row = await verifyRefreshToken(rawRefreshToken);
  const user = await prisma.user.findUnique({
    where: { id: row.userId },
    include: userWithEmployee,
  });
  if (!user) {
    throw new HttpError(401, AUTH_FAILED);
  }
  assertEmployeeActive(user);
  const accessToken = issueAccessToken(user);
  return { accessToken, refreshToken: rawRefreshToken, user: toPublicUser(user) };
}

export async function logout(rawRefreshToken: string) {
  await consumeRefreshToken(rawRefreshToken);
}

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: userWithEmployee,
  });
  if (!user) {
    throw new HttpError(401, AUTH_FAILED);
  }
  return toPublicUser(user);
}