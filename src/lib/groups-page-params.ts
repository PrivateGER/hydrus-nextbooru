import { SourceType } from "@/generated/prisma/client";
import type { OrderOption } from "@/lib/groups";

export interface GroupsPageRawParams {
  type?: string | string[];
  page?: string | string[];
  order?: string | string[];
  seed?: string | string[];
  q?: string | string[];
  creator?: string | string[];
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
const POSITIVE_INTEGER_PATTERN = /^[1-9]\d*$/;

function firstParamValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parseTextParam(value: string | string[] | undefined): string {
  return firstParamValue(value)?.trim() ?? "";
}

/**
 * Parse and normalize URL parameters for the Groups listing page.
 */
export function parseGroupsPageParams(params: GroupsPageRawParams): ParsedGroupsPageParams {
  const rawType = firstParamValue(params.type);
  const rawOrder = firstParamValue(params.order);
  const rawPage = firstParamValue(params.page)?.trim();
  const page = rawPage && POSITIVE_INTEGER_PATTERN.test(rawPage) ? Number(rawPage) : 1;
  const order = ORDER_OPTIONS.has(rawOrder as OrderOption)
    ? rawOrder as OrderOption
    : "random";

  return {
    typeFilter: rawType && SOURCE_TYPES.has(rawType) ? rawType as SourceType : undefined,
    order,
    page,
    seed: firstParamValue(params.seed) ?? "",
    query: parseTextParam(params.q),
    creatorFilter: parseTextParam(params.creator),
  };
}
