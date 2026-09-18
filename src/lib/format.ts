export const formatNumber = (value: number) => new Intl.NumberFormat("es-ES").format(value);

export const formatPct = (value: number, digits = 1) => `${value.toFixed(digits)}%`;

export const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

export const scoreLabel = (score: number) => {
  if (score >= 85) return "Excelente";
  if (score >= 70) return "Bueno";
  if (score >= 50) return "Mejorable";
  return "Crítico";
};
