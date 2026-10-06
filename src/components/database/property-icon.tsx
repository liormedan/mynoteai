import {
  Calendar,
  CircleChevronDown,
  Hash,
  Link,
  SquareCheck,
  Tags,
  Text,
  type LucideIcon,
} from "lucide-react";
import type { PropertyType } from "@/lib/database/types";

export const PROPERTY_ICONS: Record<PropertyType, LucideIcon> = {
  text: Text,
  number: Hash,
  select: CircleChevronDown,
  multiSelect: Tags,
  date: Calendar,
  checkbox: SquareCheck,
  url: Link,
};

export function PropertyIcon({
  type,
  className,
}: {
  type: PropertyType;
  className?: string;
}) {
  const Icon = PROPERTY_ICONS[type];
  return (
    <Icon aria-hidden className={className ?? "size-3.5 shrink-0 opacity-60"} />
  );
}
