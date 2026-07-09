/** Matches Pixiv placeholder usernames like "user abcd1234" or "user_abcd1234" */
export const PIXIV_USER_PATTERN = /^user[\s_]*[a-z]{4}\d{4}$/i;
const NUMERIC_CREATOR_PATTERN = /^\d+$/;
export const NUMERIC_CREATOR_SQL_PATTERN = '^[0-9]+$';
export const PIXIV_USER_SQL_PATTERN = '^user[[:space:]_]*[a-z]{4}[0-9]{4}$';

/** Checks if a creator name is valid (not numeric-only or Pixiv placeholder). */
export function isValidCreatorName(name: string): boolean {
  if (NUMERIC_CREATOR_PATTERN.test(name)) return false;
  if (PIXIV_USER_PATTERN.test(name)) return false;
  return true;
}
