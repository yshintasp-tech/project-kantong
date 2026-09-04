import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export type SessionUser = { email: string; nickname: string; canEdit: boolean };
export const localUsers = new Map<string, { email: string; password: string; nickname: string; canEdit: boolean }>([
  ["demo@kantong.app", { email: "demo@kantong.app", password: "kantong123", nickname: "Andi", canEdit: true }],
  ["yashintasyach@gmail.com", { email: "yashintasyach@gmail.com", password: "tabungangue", nickname: "Sena", canEdit: true }],
]);
const cookieName = "kantong_session";
const secret = process.env.AUTH_SECRET || "kantong-development-secret";
const resetTokens = new Map<string, { email: string; expires: number }>();

export function hashPassword(password: string, salt = randomBytes(16).toString("hex")) {
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return expected.length === candidate.length && timingSafeEqual(candidate, expected);
}

function encode(value: string) { return Buffer.from(value).toString("base64url"); }
function decode(value: string) { return Buffer.from(value, "base64url").toString(); }

export async function setSession(user: SessionUser) {
  const payload = encode(JSON.stringify({ ...user, expires: Date.now() + 7 * 86400000 }));
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  (await cookies()).set(cookieName, `${payload}.${signature}`, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 7 * 86400 });
}

export async function getSession(): Promise<SessionUser | null> {
  const value = (await cookies()).get(cookieName)?.value;
  if (!value) return null;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return null;
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const user = JSON.parse(decode(payload)) as SessionUser & { expires: number };
    return user.expires > Date.now() ? { email: user.email, nickname: user.nickname, canEdit: user.canEdit } : null;
  } catch { return null; }
}

export async function clearSession() { (await cookies()).delete(cookieName); }

export async function requireEditor() {
  const user = await getSession();
  if (!user) throw new Error("UNAUTHENTICATED");
  if (!user.canEdit) throw new Error("FORBIDDEN");
  return user;
}

export function createResetToken(email: string) {
  const token = randomBytes(32).toString("hex");
  resetTokens.set(token, { email: email.toLowerCase(), expires: Date.now() + 15 * 60 * 1000 });
  return token;
}

export function consumeResetToken(token: string) {
  const reset = resetTokens.get(token);
  resetTokens.delete(token);
  return reset && reset.expires > Date.now() ? reset : null;
}
