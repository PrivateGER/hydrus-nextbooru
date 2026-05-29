import { SourceType } from "@/generated/prisma/client";
import type { OrderOption } from "@/lib/groups";

export interface GroupsPageRawParams {
  type?: string;
  page?: string;
  order?: string;
  seed?: string;
  q?: string;
  creator?: string;
}

export interface ParsedGroupsPageParams {
  typeFilter?: SourceType;
  order: OrderOption;
  page: number;
  seed: string;
  query: string;
  creatorFilter: string;
}

const ORDER_OPTIONS = new Set<OrderOption>(["random", "newest", "oldest", "largest"]);
const SOURCE_TYPES = new Set<string>(Object.values(SourceType));

function parseTextParam(value: string | undefined): string {
  return value?.trim() ?? "";
}

/**
 * Parse and normalize URL parameters for the Groups listing page.
 */
export function parseGroupsPageParams(params: GroupsPageRawParams): ParsedGroupsPageParams {
  const parsedPage = Number.parseInt(params.page ?? "1", 10);
  const order = ORDER_OPTIONS.has(params.order as OrderOption)
    ? params.order as OrderOption
    : "random";

  return {
    typeFilter: params.type && SOURCE_TYPES.has(params.type) ? params.type as SourceType : undefined,
    order,
    page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1,
    seed: params.seed ?? "",
    query: parseTextParam(params.q),
    creatorFilter: parseTextParam(params.creator),
  };
}
