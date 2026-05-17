import { listUsers } from "../sheets/repositories/users.js";
import { isPendingProfileName } from "../sheets/repositories/users.js";

export async function resolveParticipantEmails(
  participantNames: string[],
): Promise<{
  attendees: Array<{ email: string; displayName?: string }>;
  missingEmail: string[];
}> {
  const users = await listUsers();
  const byName = new Map<string, (typeof users)[0]>();
  for (const u of users) {
    if (!u.name.trim() || isPendingProfileName(u.name)) continue;
    byName.set(u.name.trim().toLowerCase(), u);
  }

  const attendees: Array<{ email: string; displayName?: string }> = [];
  const missingEmail: string[] = [];
  const seen = new Set<string>();

  for (const name of participantNames) {
    const key = name.trim().toLowerCase();
    if (!key) continue;
    const u = byName.get(key);
    if (!u) {
      missingEmail.push(name);
      continue;
    }
    const email = u.email.trim().toLowerCase();
    if (!email) {
      missingEmail.push(name);
      continue;
    }
    if (seen.has(email)) continue;
    seen.add(email);
    attendees.push({ email, displayName: u.name.trim() });
  }

  return { attendees, missingEmail };
}
