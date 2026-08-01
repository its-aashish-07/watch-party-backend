import type { RequestHandler } from "express";
import { verifyAccessToken } from "../utils/auth.js";

export const requireAuth: RequestHandler = (request, response, next) => {
  const authorization = request.header("authorization") ?? "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    response.status(401).json({
      ok: false,
      error: { code: "AUTH_REQUIRED", message: "Log in to continue." }
    });
    return;
  }

  try {
    request.auth = verifyAccessToken(token);
    next();
  } catch {
    response.status(401).json({
      ok: false,
      error: { code: "INVALID_TOKEN", message: "Your session is invalid or has expired. Please log in again." }
    });
  }
};
