import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Bot, Send, Square, RotateCcw, MessagesSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/common/GlassCard";
import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";
import { useDataset } from "@/state/dataset-store";
import { useMlSession } from "@/state/ml-session";
import { buildAssistantContext } from "@/services/assistant-context";

export const Route = createFileRoute("/asistente")({
  head: () => ({ meta: [
    { title: "AI Data Assistant · DataClean AI" },
    { name: "description", content: "Pregunta sobre la calidad, limpieza, EDA y modelos del dataset actual con respuestas basadas en resultados reales." },
    { property: "og:title", content: "AI Data Assistant · DataClean AI" },
    { property: "og:description", content: "Asistente que explica la calidad, transformaciones, EDA y resultados de ML del dataset." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AssistantPage,
});

type Msg = { role: "user" | "assistant"; content: string };
const suggestions = [
  "¿Qué problemas tiene mi dataset?", "¿Qué columnas tienen más valores faltantes?", "¿Qué transformaciones se realizaron?",
  "¿Qué problemas todavía existen?", "¿Qué análisis debería realizar?", "¿Qué variable podría utilizar como target?",
  "¿Qué modelos podrían ser adecuados?", "¿Por qué se recomendó este modelo?", "¿Qué diferencia existe entre los modelos evaluados?", "¿Qué variables son más importantes?",
];

function AssistantPage() {
  const { dataset, originalDataset, currentTable, steps, validationRules } = useDataset();
  const { result, selected } = useMlSession();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const end = useRef<HTMLDivElement>(null);

  const context = useMemo(() => dataset && originalDataset && currentTable
    ? buildAssistantContext({ dataset, originalDataset, table: currentTable, steps, rules: validationRules, ml: result, selectedModel: selected })
    : null, [dataset, originalDataset, currentTable, steps, validationRules, result, selected]);

  useEffect(() => { abort.current?.abort(); setMessages([]); }, [currentTable === null ? null : originalDataset]);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages]);
  useEffect(() => { if (!busy) input.current?.focus(); }, [busy]);

  if (!dataset || !context) return <>
    <PageHeader title="AI Data Assistant" description="Pregunta sobre el dataset actual." />
    <EmptyState icon={MessagesSquare} title="Sin dataset activo" description="Carga un dataset en Datos para que el asistente pueda responder con sus resultados." />
  </>;

  const send = async (q: string) => {
    const question = q.trim();
    if (!question || busy) return;
    const history: Msg[] = [...messages, { role: "user", content: question }];
    setMessages([...history, { role: "assistant", content: "" }]);
    setText(""); setBusy(true);
    const ctrl = new AbortController(); abort.current = ctrl;
    const write = (content: string) => setMessages((m) => [...m.slice(0, -1), { role: "assistant", content }]);
    try {
      const res = await fetch("/api/assistant", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: history, context }), signal: ctrl.signal });
      if (!res.ok || !res.body) { write(`_${(await res.text()) || "El asistente no está disponible ahora."}_`); return; }
      const reader = res.body.getReader(); const dec = new TextDecoder(); let acc = "";
      for (;;) { const { done, value } = await reader.read(); if (done) break; acc += dec.decode(value, { stream: true }); write(acc); }
      if (!acc) write("_No se recibió respuesta._");
    } catch (e) {
      if ((e as Error).name !== "AbortError") write("_No se pudo conectar con el asistente._");
    } finally { setBusy(false); abort.current = null; }
  };

  return <>
    <PageHeader title="AI Data Assistant" description={`Responde solo con metadatos y resultados calculados de ${dataset.name}; no ve las filas.`}
      action={<Button size="sm" variant="outline" disabled={!messages.length || busy} onClick={() => setMessages([])}><RotateCcw className="size-4" />Nueva conversación</Button>} />
    <GlassCard className="flex min-h-[60vh] flex-col p-0">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {!messages.length && <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Bot className="size-4" />Prueba con una de estas preguntas:</div>
          <div className="flex flex-wrap gap-2">{suggestions.map((s) => <button key={s} type="button" onClick={() => send(s)} className="rounded-full border border-border bg-background px-3 py-1.5 text-left text-xs text-foreground hover:bg-accent">{s}</button>)}</div>
        </div>}
        {messages.map((m, i) => m.role === "user"
          ? <div key={i} className="ml-auto w-fit max-w-[85%] rounded-2xl bg-primary px-3 py-2 text-sm text-primary-foreground">{m.content}</div>
          : <div key={i} className="flex gap-2"><Bot className="mt-1 size-4 shrink-0 text-primary" />
              <div className="assistant-md min-w-0 flex-1 text-sm text-foreground">{m.content ? <ReactMarkdown>{m.content}</ReactMarkdown> : <span className="animate-pulse text-muted-foreground">Analizando resultados…</span>}</div></div>)}
        <div ref={end} />
      </div>
      <form className="flex items-end gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); void send(text); }}>
        <textarea ref={input} rows={2} value={text} onChange={(e) => setText(e.target.value)} aria-label="Pregunta para el asistente" placeholder="Pregunta sobre tu dataset…"
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(text); } }}
          className="min-h-[44px] flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
        {busy ? <Button type="button" size="icon" variant="outline" aria-label="Detener" onClick={() => abort.current?.abort()}><Square className="size-4" /></Button>
          : <Button type="submit" size="icon" aria-label="Enviar" disabled={!text.trim()}><Send className="size-4" /></Button>}
      </form>
    </GlassCard>
  </>;
}
