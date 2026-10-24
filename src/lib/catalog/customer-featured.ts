import type { Service } from "./catalog";

/**
 * The services the landing page shows (four cards beside the link to the full list): the first ones
 * in admin's order that have a photo, so the row of cards stays even. When too few have one, services
 * without a photo fill the row; the result always keeps admin's order.
 */
export function pickFeatured(services: readonly Service[], hasPhoto: (service: Service) => boolean, count: number) {
  const withPhoto = services.filter(hasPhoto).slice(0, count);
  const chosen = new Set(withPhoto.map((service) => service.id));
  for (const service of services) {
    if (chosen.size >= count) break;
    chosen.add(service.id);
  }
  return services.filter((service) => chosen.has(service.id));
}
