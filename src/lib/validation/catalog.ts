import { z } from "zod";
import { serviceCategories, type CatalogFilters } from "@/lib/catalog/catalog";

// The catalog's filters as they arrive in the address (?area=...&type=...&q=...) of the customer pages
// (markdown/CONSTRAINTS.md: user input is parsed with Zod). A visitor can type anything there, so
// nothing fails the page: a value that is not understood is simply ignored, and a long keyword is cut.

const maxQueryLength = 60;

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(40);

const schema = z.object({
  area: slug.optional().catch(undefined),
  type: z.enum(serviceCategories).optional().catch(undefined),
  q: z
    .string()
    .trim()
    .transform((value) => value.slice(0, maxQueryLength))
    .optional()
    .catch(undefined),
});

type SearchParams = Record<string, string | string[] | undefined>;

/** The first value of a parameter that appears more than once (?type=a&type=b). */
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export function parseCatalogFilters(params: SearchParams): CatalogFilters {
  const { area, type, q } = schema.parse({ area: first(params.area), type: first(params.type), q: first(params.q) });
  const filters: CatalogFilters = {};
  if (area) filters.areaId = area;
  if (type) filters.category = type;
  if (q) filters.query = q;
  return filters;
}
