import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

export const notFoundHandler: RequestHandler = (_request, response) => {
  response.status(404).json({ ok: false, error: { code: "NOT_FOUND", message: "Route not found." } });
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (error instanceof ZodError) {
    response.status(400).json({
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "Invalid request data.", details: error.flatten().fieldErrors }
    });
    return;
  }

  console.error(error);
  response.status(500).json({ ok: false, error: { code: "INTERNAL_ERROR", message: "Unexpected server error." } });
};
