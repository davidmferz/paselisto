import { randomBytes } from "node:crypto";

/** 128-bit unguessable pass token, base64url (22 chars). */
export function generateToken(): string {
  return randomBytes(16).toString("base64url");
}
