import { beforeEach, describe, expect, it, vi } from "vitest";

const VALID_HASH = "a".repeat(64);

const mocks = vi.hoisted(() => ({
  checkRateLimit: vi.fn(),
  getClientIPFromHeaders: vi.fn(),
  searchNotes: vi.fn(),
  searchPosts: vi.fn(),
  searchSemanticPosts: vi.fn(),
}));

vi.mock("next/cache", () => ({
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers()),
}));

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("@/components/post-grid", () => ({ PostGrid: () => null }));
vi.mock("@/components/pagination", () => ({ Pagination: () => null }));
vi.mock("@/components/search-bar", () => ({ SearchBar: () => null }));
vi.mock("@/components/similar-search", () => ({ SimilarSearch: () => null }));
vi.mock("@/components/semantic-image-results", () => ({ SemanticImageResults: () => null }));
vi.mock("@/components/note-search-result", () => ({ NoteSearchResult: () => null }));
vi.mock("@/components/skeletons", () => ({
  SearchBarSkeleton: () => null,
  PostGridSkeleton: () => null,
  PageHeaderSkeleton: () => null,
}));
vi.mock("@/generated/prisma/client", () => ({
  TagCategory: { GENERAL: "GENERAL" },
}));
vi.mock("@/lib/tag-colors", () => ({
  TAG_BADGE_COLORS: {},
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: mocks.checkRateLimit,
  getClientIPFromHeaders: mocks.getClientIPFromHeaders,
}));

vi.mock("@/lib/search", () => ({
  searchNotes: mocks.searchNotes,
  searchPosts: mocks.searchPosts,
  searchSemanticPosts: mocks.searchSemanticPosts,
  SEMANTIC_SEARCH_RATE_LIMIT_CONFIG: {
    prefix: "posts-semantic-search",
    limit: 30,
    windowMs: 60_000,
  },
}));

vi.mock("@/lib/favorites", () => ({
  mergeFavoritedState: vi.fn(async (posts: { id: number }[]) =>
    posts.map((post) => ({ ...post, favorited: false })),
  ),
}));

import SearchPage from "./page";

async function renderSearchPageContent(params: Record<string, string>) {
  const pageElement = SearchPage({ searchParams: Promise.resolve(params) }) as React.ReactElement<{
    children: React.ReactElement<{ searchParams: Promise<Record<string, string>> }>;
  }>;
  const contentElement = pageElement.props.children;
  const Content = contentElement.type as (props: typeof contentElement.props) => Promise<React.ReactElement>;
  return Content(contentElement.props);
}

/** Walk a rendered element tree and return the first `source` prop found (SemanticImageResults). */
function findSemanticSource(node: unknown): unknown {
  if (!node || typeof node !== "object") return undefined;
  const element = node as { props?: { source?: unknown; children?: unknown } };
  if (element.props?.source) return element.props.source;
  const children = element.props?.children;
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    const found = findSemanticSource(child);
    if (found) return found;
  }
  return undefined;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getClientIPFromHeaders.mockReturnValue("127.0.0.1");
  mocks.checkRateLimit.mockReturnValue({ allowed: true });
  mocks.searchNotes.mockResolvedValue({ notes: [], totalCount: 0, totalPages: 0, queryTimeMs: 0 });
  mocks.searchPosts.mockResolvedValue({ posts: [], totalCount: 0, totalPages: 0, queryTimeMs: 0 });
  mocks.searchSemanticPosts.mockResolvedValue({ posts: [], totalCount: 0, totalPages: 0, queryTimeMs: 0 });
});

describe("SearchPage", () => {
  it("renders semantic-image mode without running text search work from stale params", async () => {
    const element = await renderSearchPageContent({
      mode: "semantic-image",
      imgHash: VALID_HASH,
      semantic: "leftover text query",
    });

    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.searchSemanticPosts).not.toHaveBeenCalled();
    expect(mocks.searchNotes).not.toHaveBeenCalled();
    expect(mocks.searchPosts).not.toHaveBeenCalled();
    expect(findSemanticSource(element)).toEqual({ kind: "upload", hash: VALID_HASH });
  });

  it("renders semantic-post mode without running text search work from stale params", async () => {
    const element = await renderSearchPageContent({
      mode: "semantic-post",
      postHash: VALID_HASH,
      semantic: "leftover text query",
    });

    expect(mocks.checkRateLimit).not.toHaveBeenCalled();
    expect(mocks.searchSemanticPosts).not.toHaveBeenCalled();
    expect(mocks.searchNotes).not.toHaveBeenCalled();
    expect(mocks.searchPosts).not.toHaveBeenCalled();
    expect(findSemanticSource(element)).toEqual({ kind: "post", hash: VALID_HASH });
  });
});
