import { describe, expect, it } from "vitest";
import { createAccessToken, hashPassword, verifyAccessToken, verifyPassword } from "../src/utils/auth.js";

describe("authentication helpers", () => {
  it("hashes and verifies passwords", async () => {
    const password = "strong-password";
    const passwordHash = await hashPassword(password);

    expect(passwordHash).not.toBe(password);
    await expect(verifyPassword(password, passwordHash)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", passwordHash)).resolves.toBe(false);
  });

  it("creates and verifies access tokens", () => {
    const claims = { userId: "user-123", name: "Alex Morgan", email: "alex@example.com" };
    const token = createAccessToken(claims);

    expect(verifyAccessToken(token)).toEqual(claims);
  });
});
