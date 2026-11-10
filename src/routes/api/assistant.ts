import { createFileRoute } from "@tanstack/react-router";
import { streamResponse, GatewayError } from "@lovable.dev/ai-gateway";

const SYSTEM = `Eres el AI Data Assistant de DataClean AI. Respondes en español a analistas de datos.
Solo conoces el CONTEXTO JSON del dataset actual (metadatos y resultados calculados por la aplicación). No ves filas crudas.
Reglas estrictas:
- Toda cifra (porcentajes, conteos, métricas, correlaciones, scores) debe copiarse del CONTEXTO. Nunca estimes, redondees de forma engañosa ni inventes estadísticas.
- Si el CONTEXTO no contiene la información (por ejemplo, no hay experimento de ML, no hay transformaciones), dilo claramente e indica en qué sección de la aplicación obtenerla (Calidad, Limpieza, Validación, EDA, Machine Learning).
- No declares un modelo "el mejor" en general: limita las conclusiones al experimento, división y métricas registradas. Una métrica alta no implica fiabilidad.
- Si el dataset es de demostración (isDemo), recuérdalo.
- Cuando recomiendes una acción, estructura la respuesta con: 1. Qué se detectó, 2. Por qué es importante, 3. Qué se recomienda, 4. Impacto posible, 5. Qué debería revisar el analista.
- Usa Markdown breve (listas, tablas pequeñas). Sé claro y concreto.`;

type Msg = { role: "user" | "assistant"; content: string };

export const Route = createFileRoute("/api/assistant")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { messages?: Msg[]; context?: unknown };
        try { body = await request.json(); } catch { return new Response("Solicitud inválida", { status: 400 }); }
        const messages = (body.messages ?? []).filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string").slice(-20);
        const context = JSON.stringify(body.context ?? null);
        if (!messages.length || messages.at(-1)?.role !== "user") return new Response("Falta la pregunta", { status: 400 });
        if (context.length > 200_000) return new Response("Contexto demasiado grande", { status: 413 });
        try {
          const stream = await streamResponse({
            model: "openai/gpt-6-astra",
            instructions: `${SYSTEM}\n\nCONTEXTO:\n${context}`,
            input: messages.map((m) => m.role === "assistant"
              ? { role: "assistant" as const, content: [{ type: "output_text" as const, text: m.content }] }
              : { role: "user" as const, content: m.content.slice(0, 4000) }),
          });
          const encoder = new TextEncoder();
          const out = new ReadableStream<Uint8Array>({
            async start(controller) {
              try {
                for await (const ev of stream) {
                  if (ev.type === "response.output_text.delta") controller.enqueue(encoder.encode(ev.delta));
                }
              } catch (e) {
                controller.enqueue(encoder.encode(`\n\n_No se pudo completar la respuesta${e instanceof GatewayError ? ` (${e.code})` : ""}._`));
              }
              controller.close();
            },
          });
          return new Response(out, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
        } catch (e) {
          const status = e instanceof GatewayError && e.httpStatus ? e.httpStatus : 500;
          const msg = status === 429 ? "Demasiadas solicitudes; espera un momento." : status === 402 ? "No hay créditos de IA disponibles." : "El asistente no está disponible ahora.";
          return new Response(msg, { status });
        }
      },
    },
  },
});
