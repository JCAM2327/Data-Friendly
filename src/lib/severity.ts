import type { QualitySeverity } from "./types";
import type { BadgeTone } from "@/components/common/StatusBadge";

export const severityLabel: Record<QualitySeverity, string> = {
  critica: "Crítica",
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export const severityTone: Record<QualitySeverity, BadgeTone> = {
  critica: "danger",
  alta: "danger",
  media: "warning",
  baja: "info",
};
