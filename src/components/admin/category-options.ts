import { getTranslations } from "next-intl/server";
import { serviceCategories } from "@/lib/catalog/catalog";

/** The service types for the form's select, named in the page's language (on the server, so the list's
 * names and the form's options are the same words). */
export async function categoryOptions(): Promise<{ value: string; label: string }[]> {
  const t = await getTranslations("AdminServicesPage");
  return serviceCategories.map((value) => ({ value, label: t(`categories.${value}`) }));
}
