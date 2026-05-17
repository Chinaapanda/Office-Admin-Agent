import { listUsers } from "../sheets/repositories/users.js";
import type { UserRow } from "../sheets/schemas.js";

let cache: UserRow[] | null = null;
let cacheAt = 0;
const TTL_MS = 30_000;

async function getUsersCached(): Promise<UserRow[]> {
  const now = Date.now();
  if (cache && now - cacheAt < TTL_MS) return cache;
  cache = await listUsers();
  cacheAt = now;
  return cache;
}

export function invalidateUserCache(): void {
  cache = null;
}

/** Match by exact name (case-insensitive trim) */
export async function resolveLineUserIdByName(
  name: string,
): Promise<string | undefined> {
  const users = await getUsersCached();
  const n = name.trim().toLowerCase();
  const u = users.find(
    (x) => x.name.trim().toLowerCase() === n && x.active && x.lineUserId,
  );
  return u?.lineUserId;
}

export async function getUserByName(
  name: string,
): Promise<UserRow | undefined> {
  const users = await getUsersCached();
  const n = name.trim().toLowerCase();
  return users.find((x) => x.name.trim().toLowerCase() === n);
}

/** Resolve manager's LINE id for a user (by responsible person's name) */
export async function resolveManagerLineIdForPerson(
  personName: string,
): Promise<string | undefined> {
  const person = await getUserByName(personName);
  if (!person?.manager.trim()) return undefined;
  return resolveLineUserIdByName(person.manager);
}
