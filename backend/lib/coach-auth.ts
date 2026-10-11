import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Returns an error response when the request lacks the coach passcode, or null when it's allowed. */
export function requireCoach(request: Request): Response | null {
  const expected = process.env.COACH_PASSCODE;
  if (!expected) {
    return Response.json({ error: "COACH_PASSCODE is not set on the server." }, { status: 503 });
  }
  const given = request.headers.get("x-coach-passcode") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "Wrong coach passcode." }, { status: 401 });
  }
  return null;
}
