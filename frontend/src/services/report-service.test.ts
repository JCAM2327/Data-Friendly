import { describe, expect, test } from "bun:test";
import type { QualityIssue } from "@/lib/types";
import { profileTable } from "./profiling-service";
import { buildReport, compareIssues, historyCsv } from "./report-service";
import { assessQuality, type ValidationRule } from "./validation-service";

const issue = (id: string, affectedRows: number): QualityIssue => ({ id, affectedRows, title: id, detail: id, severity: "media" });
const originalTable = { headers: ["Precio", "Producto"], rows: [{ Precio: -10, Producto: "A" }, { Precio: 20, Producto: "B" }, { Precio: 20, Producto: "B" }] };
const currentTable = { headers: ["Precio", "Producto"], rows: [{ Precio: 10, Producto: "A" }, { Precio: 20, Producto: "B" }] };
const meta = { name: "precios.csv", source: "CSV", sizeLabel: "100 B" };
const rules: ValidationRule[] = [{ id: "precio", kind: "min", column: "Precio", min: 0, critical: true }];

describe("Dataset quality report", () => {
  test("reports original rows and columns without using the cleaned counts", () => {
    const report = buildReport({ original: profileTable(originalTable, meta), current: profileTable(currentTable, meta), originalTable, currentTable, rules, steps: [], history: [], generatedAt: "2026-11-01T18:10:00Z" });
    expect(report.original.rows).toBe(3);
    expect(report.original.columns).toBe(2);
    expect(report.current.rows).toBe(2);
  });
  test("partial corrections remain pending and new issues do not count as corrections", () => {
    expect(compareIssues([issue("nulls", 10), issue("duplicates", 2)], [issue("nulls", 3), issue("outliers", 1)])).toEqual({ found: 2, corrected: 1, pending: 2, newIssues: 1 });
  });
  test("quality before and after use the same real-data validation rule Precio >= 0", () => {
    const original = profileTable(originalTable, meta), current = profileTable(currentTable, meta);
    const report = buildReport({ original, current, originalTable, currentTable, rules, steps: [], history: [], generatedAt: "2026-11-01T18:10:00Z" });
    expect(report.before.results[0]?.failed).toBe(1);
    expect(report.after.results[0]?.failed).toBe(0);
    expect(report.before.score).toBe(assessQuality(originalTable, original, rules).score);
    expect(report.after.score).toBeGreaterThanOrEqual(0);
    expect(report.after.score).toBeLessThanOrEqual(100);
  });
  test("EDA excludes original negative prices from the cleaned-data analysis", () => {
    const report = buildReport({ original: profileTable(originalTable, meta), current: profileTable(currentTable, meta), originalTable, currentTable, rules, steps: [], history: [], generatedAt: "2026-11-01T18:10:00Z" });
    expect(report.eda.numeric.find((n) => n.column === "Precio")?.mean).toBe(15);
    expect(report.eda.numeric.find((n) => n.column === "Precio")?.min).toBe(10);
  });
  test("CSV export escapes untrusted spreadsheet formulas and quotes", () => {
    const csv = historyCsv([{ id: "1", at: "2026-11-01", kind: "carga", label: '=HYPERLINK("x")', detail: "test,detail" }]);
    expect(csv).toContain('"\'=HYPERLINK(""x"")"');
    expect(csv).toContain('"test,detail"');
  });
});