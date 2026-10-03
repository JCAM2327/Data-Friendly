import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACCEPTED_EXTENSIONS, formatBytes, loadFile, type LoadedFile } from "@/services/file-parser";
import { profileTable } from "@/services/profiling-service";
import type { DatasetSummary } from "@/lib/types";

/** Carga un archivo, permite elegir hoja (Excel) y entrega el diagnóstico. */
export function FileUploader({ onAnalyzed }: { onAnalyzed: (summary: DatasetSummary) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loaded, setLoaded] = useState<LoadedFile | null>(null);
  const [sheet, setSheet] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const analyze = (lf: LoadedFile, f: File, sheetName?: string) => {
    setBusy(true);
    setError(null);
    // Ceder un frame para que se pinte el estado de carga.
    setTimeout(() => {
      try {
        const table = lf.readTable(sheetName);
        if (table.headers.length === 0 || table.rows.length === 0) {
          throw new Error("No se encontraron filas con datos.");
        }
        onAnalyzed(
          profileTable(table, {
            name: f.name,
            source: `Archivo ${lf.format.toUpperCase()}`,
            sizeLabel: formatBytes(f.size),
            sheetName,
          }),
        );
        setFile(null);
        setLoaded(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "No se pudo analizar el archivo.");
      } finally {
        setBusy(false);
      }
    }, 30);
  };

  const handleFile = async (f: File) => {
    setError(null);
    setBusy(true);
    try {
      const lf = await loadFile(f);
      setFile(f);
      setLoaded(lf);
      setBusy(false);
      if (lf.sheets.length > 1) setSheet(lf.sheets[0]!);
      else analyze(lf, f, lf.sheets[0]);
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    }
  };

  const needsSheet = loaded && loaded.sheets.length > 1 && file;

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files[0];
          if (f) void handleFile(f);
        }}
        className={`glass-inset flex flex-col items-center gap-2 rounded-xl border border-dashed p-6 text-center ring-1 ring-white/50 transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border"
        }`}
      >
        <span className="grid size-10 place-items-center rounded-lg bg-primary/12 text-primary">
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Upload className="size-5" aria-hidden />}
        </span>
        <p className="text-[13px] font-medium">
          {busy ? "Leyendo y analizando…" : "Arrastra un archivo o selecciónalo"}
        </p>
        <p className="text-[11px] text-muted-foreground">
          CSV, XLSX, XLS o JSON · se procesa en tu navegador, sin subirlo a ningún servidor
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        <Button size="sm" className="mt-1" disabled={busy} onClick={() => inputRef.current?.click()}>
          Seleccionar archivo
        </Button>
      </div>

      {needsSheet ? (
        <div className="glass-inset flex flex-wrap items-end gap-3 rounded-xl p-3 ring-1 ring-white/50">
          <FileSpreadsheet className="mb-2 size-4 text-primary" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium">{file.name}</p>
            <label htmlFor="sheet" className="text-[11px] text-muted-foreground">
              {loaded.sheets.length} hojas disponibles · elige cuál analizar
            </label>
            <select
              id="sheet"
              value={sheet}
              onChange={(e) => setSheet(e.target.value)}
              className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-[13px]"
            >
              {loaded.sheets.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <Button size="sm" disabled={busy} onClick={() => analyze(loaded, file, sheet)}>
            Analizar hoja
          </Button>
        </div>
      ) : null}

      {error ? (
        <p className="flex items-center gap-2 rounded-lg bg-danger/10 px-3 py-2 text-[12px] text-danger ring-1 ring-danger/20">
          <AlertTriangle className="size-4 shrink-0" aria-hidden />
          {error}
        </p>
      ) : null}
    </div>
  );
}
