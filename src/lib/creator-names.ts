/** Matches Pixiv placeholder usernames like "user abcd1234" or "user_abcd1234" */
export const PIXIV_USER_PATTERN = /^user[\s_]*[a-z]{4}\d{4}$/i;

/** Checks if a creator name is valid (not numeric-only or Pixiv placeholder). */
export function isValidCreatorName(name: string): boolean {
  if (/^\d+$/.test(name)) return false;
  if (PIXIV_USER_PATTERN.test(name)) return false;
  return true;
}
