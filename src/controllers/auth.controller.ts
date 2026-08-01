import type { RequestHandler } from "express";
import { nanoid } from "nanoid";
import { z } from "zod";
import { UserModel, type UserDocument } from "../models/user.model.js";
import { createAccessToken, hashPassword, verifyPassword } from "../utils/auth.js";

const emailSchema = z.string().trim().email().max(160).transform((value) => value.toLowerCase());
const signupSchema = z.object({
  name: z.string().trim().min(2).max(60),
  email: emailSchema,
  password: z.string().min(8).max(72)
});
const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(72)
});

function userDTO(user: Pick<UserDocument, "_id" | "name" | "email" | "createdAt">) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString()
  };
}

export const signup: RequestHandler = async (request, response, next) => {
  try {
    const input = signupSchema.parse(request.body);
    const existingUser = await UserModel.exists({ email: input.email });
    if (existingUser) {
      response.status(409).json({
        ok: false,
        error: { code: "EMAIL_IN_USE", message: "An account already exists with this email address." }
      });
      return;
    }

    const user = await UserModel.create({
      _id: nanoid(18),
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password)
    });
    const token = createAccessToken({ userId: user._id, name: user.name, email: user.email });

    response.status(201).json({ ok: true, data: { user: userDTO(user), token } });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && (error as { code?: number }).code === 11000) {
      response.status(409).json({
        ok: false,
        error: { code: "EMAIL_IN_USE", message: "An account already exists with this email address." }
      });
      return;
    }
    next(error);
  }
};

export const login: RequestHandler = async (request, response, next) => {
  try {
    const input = loginSchema.parse(request.body);
    const user = await UserModel.findOne({ email: input.email }).select("+passwordHash").exec();
    if (!user || !await verifyPassword(input.password, user.passwordHash)) {
      response.status(401).json({
        ok: false,
        error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect." }
      });
      return;
    }

    const token = createAccessToken({ userId: user._id, name: user.name, email: user.email });
    response.json({ ok: true, data: { user: userDTO(user), token } });
  } catch (error) {
    next(error);
  }
};

export const me: RequestHandler = async (request, response, next) => {
  try {
    const user = await UserModel.findById(request.auth?.userId).exec();
    if (!user) {
      response.status(401).json({
        ok: false,
        error: { code: "USER_NOT_FOUND", message: "This account no longer exists." }
      });
      return;
    }
    response.json({ ok: true, data: { user: userDTO(user) } });
  } catch (error) {
    next(error);
  }
};
