import type { AccessTokenClaims } from "../utils/auth.js";

declare global {
  namespace Express {
    interface Request {
      auth?: AccessTokenClaims;
    }
  }
}

export {};
