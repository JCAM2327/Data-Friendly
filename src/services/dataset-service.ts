/**
 * Utilidades de dataset y generador del set de DEMOSTRACIÓN.
 * El set demo es una tabla real (generada) que pasa por el mismo
 * perfilado que cualquier archivo; siempre se marca como demostración.
 */
import type { QualityIssue } from "@/lib/types";
import type { RawTable } from "./file-parser";

export function countBySeverity(issues: QualityIssue[]) {
  const n = (s: QualityIssue["severity"]) => issues.filter((i) => i.severity === s).length;
  const critica = n("critica"), alta = n("alta"), media = n("media"), baja = n("baja");
  /** critico/aviso/ok: agregados para vistas resumidas. */
  return { critica, alta, media, baja, critico: critica + alta, aviso: media + baja, ok: 0 };
}

/** Generador pseudoaleatorio determinista para que la demo sea reproducible. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function createDemoTable(): RawTable {
  const r = rng(42);
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)]!;
  const paises = ["España", "España", "España", "espana", "ESPANA", "España.", "Espna", "México", "Mexico", "Perú", "Peru", "Chile"];
  const canales = ["web", "Web ", "tienda", "TIENDA", "app", "  app"];
  const headers = ["id_transaccion", "cliente", "pais", "canal", "fecha_compra", "importe", "unidades", "descuento"];
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < 240; i++) {
    const d = 1 + Math.floor(r() * 28);
    const m = 1 + Math.floor(r() * 12);
    const fmt = r();
    const fecha =
      fmt < 0.6
        ? `2024-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
        : fmt < 0.9
          ? `${d}/${m}/2024`
          : r() < 0.5 ? "" : `${String(d).padStart(2, "0")}-${String(m).padStart(2, "0")}-2024`;
    const importeBase = Math.round((20 + r() * 180) * 100) / 100;
    const importe =
      i % 47 === 0 ? 9850 : i % 13 === 0 ? `${importeBase} €` : r() < 0.05 ? null : importeBase;
    rows.push({
      id_transaccion: `TRX-${1000 + i}`,
      cliente: `  cliente ${Math.floor(r() * 60)}`.replace(/^\s+/, r() < 0.3 ? "  " : ""),
      pais: pick(paises),
      canal: pick(canales),
      fecha_compra: fecha,
      importe,
      unidades: r() < 0.08 ? null : String(1 + Math.floor(r() * 5)) + ".0",
      descuento: r() < 0.55 ? null : Math.round(r() * 30),
    });
  }
  // Duplicados exactos
  for (const i of [5, 18, 33, 61, 90, 120, 150]) rows.push({ ...rows[i]! });
  return { headers, rows };
}
