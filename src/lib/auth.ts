import "server-only";
import { cookies } from "next/headers";
import { COOKIE, sessionRole, verifyToken, type Role } from "./session";

export {
  ADMIN_PASSWORD,
  COOKIE,
  adminConfigured,
  checkPassword,
  cookieOptions,
  issueToken,
  passwordRole,
  sessionRole,
  verifyToken,
} from "./session";
export type { Role } from "./session";

/** Whether the current request carries a valid admin session. */
export async function isAuthed(): Promise<boolean> {
  const jar = await cookies();
  return verifyToken(jar.get(COOKIE)?.value);
}

/** The current request's role: "admin", "producer", or null when signed out. */
export async function currentRole(): Promise<Role | null> {
  const jar = await cookies();
  return sessionRole(jar.get(COOKIE)?.value);
}

/** The owner or a producer: everything the Control Center needs, and nothing more. */
export async function canRunShow(): Promise<boolean> {
  return (await currentRole()) !== null;
}
