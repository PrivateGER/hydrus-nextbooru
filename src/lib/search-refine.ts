/**
 * Build a search URL that refines the current tag query with one more tag.
 *
 * The tag is appended to the existing comma-separated query. If the tag is
 * already present (in either polarity, compared case-insensitively), its
 * polarity is replaced rather than duplicated. The page number intentionally
 * resets: a refined query is a new result set.
 */
export function buildRefinedSearchUrl(
  currentTags: string[],
  tag: string,
  options?: { negate?: boolean }
): string {
  const refined = options?.negate ? `-${tag}` : tag;
  const tagLower = tag.toLowerCase();

  const kept = currentTags.filter((existing) => {
    const bareExisting = existing.startsWith("-") ? existing.slice(1) : existing;
    return bareExisting.toLowerCase() !== tagLower;
  });

  const params = new URLSearchParams();
  params.set("tags", [...kept, refined].join(","));
  return `/search?${params.toString()}`;
}
