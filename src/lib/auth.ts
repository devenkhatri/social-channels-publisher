import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { config } from "./config";

export const COOKIE_NAME = "scp_session";

function getSecretKey() {
  return new TextEncoder().encode(config.SESSION_SECRET);
}

export async function verifyPassword(provided: string): Promise<boolean> {
  const adminPassword = config.ADMIN_PASSWORD;
  
  // If stored as bcrypt hash
  if (adminPassword.startsWith("$2a$") || adminPassword.startsWith("$2b$") || adminPassword.startsWith("$2y$")) {
    return bcrypt.compare(provided, adminPassword);
  }
  
  // Otherwise direct string compare
  return provided === adminPassword;
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<{ valid: boolean; payload?: any }> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return { valid: true, payload };
  } catch {
    return { valid: false };
  }
}
