import { Info } from "lucide-react";

/** Aviso obligatorio cuando los valores mostrados son de demostración. */
export function DemoNotice({ text }: { text?: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-warning/12 p-3 ring-1 ring-warning/25">
      <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0">
        <p className="text-[13px] font-medium">Datos de demostración</p>
        <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">
          {text ??
            "Los valores mostrados son un ejemplo. Carga un dataset real para reemplazarlos por un análisis propio."}
        </p>
      </div>
    </div>
  );
}
