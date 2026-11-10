# Data Friendly Frontend

Interfaz web de Data Friendly para cargar, diagnosticar, limpiar, validar y analizar datasets tabulares.

## Desarrollo

```bash
bun install
bun run dev
```

El lockfile del proyecto usa Bun. La API del backend debe estar disponible en la URL configurada en `VITE_API_BASE_URL`.

## Verificación

```bash
bun run lint
bun test
bunx tsc --noEmit
bun run build
```

## Integración

El frontend consumirá el backend Python como única fuente de verdad para el procesamiento de datos. La lógica local de análisis se irá retirando durante la integración.

El asistente recibe únicamente metadatos y resultados calculados; nunca filas crudas, previews ni valores de muestra.
