import type { UserRow } from "../sheets/schemas.js";
import { isPendingProfileName } from "../sheets/repositories/users.js";

export function isRegistered(user: UserRow | undefined): boolean {
  return Boolean(user?.lineUserId);
}

export function isActiveUser(user: UserRow | undefined): boolean {
  return isRegistered(user) && user!.active !== false;
}

export function canUseWriteTools(user: UserRow | undefined): boolean {
  return isActiveUser(user);
}

export function isAdmin(user: UserRow | undefined): boolean {
  return user?.role === "admin";
}

/** User exists in sheet but has not set a real name via chat or admin */
export function isProfileIncomplete(user: UserRow | undefined): boolean {
  return isRegistered(user) && isPendingProfileName(user!.name);
}
