# Data Friendly

Producto único que reúne una interfaz web para explorar, limpiar, validar y analizar datasets tabulares con un motor Python canónico.

## Estado

Fase 1: monorepo creado e importación inicial de los dos componentes. La integración funcional, el despliegue y la limpieza de branding están pendientes.

## Estructura

```text
Data-Friendly/
  frontend/   # interfaz web
  backend/    # API y motor de análisis en Python
  docs/       # arquitectura y documentación técnica
  infra/      # contenedores y despliegue
```

## Componentes

- `frontend/`: aplicación web con carga de archivos, paneles de calidad, limpieza, EDA, validación, modelado e informes.
- `backend/`: API FastAPI con perfilado, detección de problemas, planes de limpieza, EDA, validación, modelado, clustering y asesor de estrategia.

## Desarrollo local

### Backend

```bash
cd backend
python -m venv .venv
source .venv/Scripts/activate
pip install -r requirements.txt
uvicorn dataclean.api:app --reload
```

En Windows con Git Bash, el ejecutable de Python puede estar fuera del `PATH`. Usa la ruta completa si es necesario.

La API queda disponible en `http://localhost:8000`. La documentación interactiva está en `/docs`.

### Frontend

```bash
cd frontend
bun install
bun run dev
```

El frontend usa Bun por el lockfile actual. Si no está instalado, instálalo antes de continuar.

## Variables de entorno

Copia `.env.example` y ajusta los valores. Las variables del backend se leen en el proceso de la API; las del frontend deben empezar por `VITE_` para exponerse al cliente.

## Verificación

```bash
cd backend && pytest
cd frontend && bun run lint && bun test && bunx tsc --noEmit && bun run build
```

## Documentación

- `docs/ARCHITECTURE.md`: límites entre componentes y decisiones de integración.
- `infra/README.md`: estado de la infraestructura de despliegue.
