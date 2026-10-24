import { DoorOpen, House, Sofa, type LucideIcon } from "lucide-react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { Service, ServiceCategory } from "@/lib/catalog/catalog";
import { servicePhoto } from "./service-photos";

// A service's picture: its photo when it has one (src/components/customer/service-photos.ts),
// otherwise its type's icon on a quiet tile of the same size, so a new service never leaves a hole.
// The tile is decorative: the service's name sits right next to it.
const typeIcons: Record<ServiceCategory, LucideIcon> = {
  "whole-home": House,
  rooms: DoorOpen,
  fabrics: Sofa,
};

// The tile's colours, and the fill a photo shows while it loads.
const tones = {
  evergreen: { tile: "bg-brand-50 text-brand-700", photo: "bg-surface-sunken" },
  forest: { tile: "bg-lime-wash text-on-lime-wash", photo: "bg-sunken" },
};

type ServiceVisualProps = {
  service: Service;
  /** next/image sizes, for the photo's width on each screen. */
  sizes: string;
  /** Size, shape and position, the same for the photo and the tile. */
  className: string;
  /** Fill the positioned parent instead of sizing by the photo's own proportions. */
  fill?: boolean;
  /** Size of the icon on the tile. */
  iconClassName?: string;
  /** evergreen: the T3b customer pages; forest: the landing page (markdown/design.md). */
  tone?: keyof typeof tones;
};

export function ServiceVisual({
  service,
  sizes,
  className,
  fill = false,
  iconClassName = "size-6",
  tone = "evergreen",
}: ServiceVisualProps) {
  const t = useTranslations("ServicePhotos");
  const match = servicePhoto(service.id);

  if (!match) {
    const Icon = typeIcons[service.category];
    return (
      <span
        aria-hidden="true"
        className={`flex items-center justify-center ${fill ? "absolute inset-0" : ""} ${tones[tone].tile} ${className}`}
      >
        <Icon className={iconClassName} strokeWidth={1.75} />
      </span>
    );
  }

  const { key, photo } = match;
  const size = fill ? { fill: true } : { width: photo.width, height: photo.height };
  return (
    <Image
      src={photo.src}
      alt={t(key)}
      sizes={sizes}
      {...size}
      style={{ objectPosition: photo.focus }}
      className={`object-cover ${tones[tone].photo} ${className}`}
    />
  );
}
