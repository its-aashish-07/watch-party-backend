import bcrypt from "bcryptjs";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AccessTokenClaims {
  userId: string;
  name: string;
  email: string;
}

const HASH_ROUNDS = 12;

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, HASH_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}

export function createAccessToken(claims: AccessTokenClaims): string {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"],
    issuer: "syncroom-watch-party-api",
    audience: "syncroom-watch-party-web"
  };
  return jwt.sign(
    { name: claims.name, email: claims.email },
    env.JWT_SECRET,
    { ...options, subject: claims.userId }
  );
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  const decoded = jwt.verify(token, env.JWT_SECRET, {
    issuer: "syncroom-watch-party-api",
    audience: "syncroom-watch-party-web"
  });

  if (typeof decoded === "string") {
    throw new Error("Invalid access token payload.");
  }

  const payload = decoded as JwtPayload;
  if (!payload.sub || typeof payload.name !== "string" || typeof payload.email !== "string") {
    throw new Error("Invalid access token claims.");
  }

  return {
    userId: payload.sub,
    name: payload.name,
    email: payload.email
  };
}
