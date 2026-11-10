# Arquitectura de Data Friendly

## Decisión

Data Friendly es un monorepo con dos componentes desplegables por separado:

- `frontend/`: interfaz de usuario.
- `backend/`: API y motor de análisis en Python.

Los repositorios históricos quedan congelados como referencia. El desarrollo del producto continúa en este repositorio.

## Límites

### Backend

Es la única fuente de verdad para el procesamiento de datos:

- Carga y validación de archivos.
- Perfilado y detección de problemas de calidad.
- Planes de limpieza y aplicación de transformaciones.
- EDA.
- Validación.
- Modelado y comparación de modelos.
- Clustering y asesor de estrategia.
- Informe HTML y exportación del dataset limpio.

La API usa `X-User-Id` para aislar sesiones anónimas. El almacenamiento es temporal y tiene TTL.

### Frontend

Es responsable de la experiencia de usuario:

- Carga y selección de datasets.
- Navegación entre módulos.
- Visualizaciones y tablas.
- Confirmaciones y avisos de privacidad.
- Asistente conversacional.

En producción, el frontend no ejecutará análisis pesados en el navegador. Las llamadas irán al backend mediante un cliente API único.

## Flujo previsto

```text
Navegador
  -> frontend (Vercel)
      -> API Python (Render)
          -> almacenamiento temporal con TTL
```

El asistente recibe metadatos y resultados calculados. No recibe filas crudas del dataset.

## Brechas conocidas

- El backend actual genera planes de limpieza automáticos; la UI necesita operaciones granulares.
- Falta un endpoint para ejecutar modelado con parámetros elegidos por el usuario.
- El frontend todavía contiene procesamiento local que se retirará de producción.
- El branding del frontend todavía debe unificarse como Data Friendly.

## Completado en la estabilización del backend

- Carga en memoria, sin archivos temporales en `/tmp`.
- Saneamiento de nombres de archivo y validación de `X-User-Id`.
- Preview con `NaN` convertido a `null`.
- Contratos restaurados de preview, importancias y descarga del CSV limpio.
- CORS sin credenciales y configuración leída en runtime.
- Asesor del informe calculado sobre el dataset limpio cuando corresponde.
- OpenAPI con response models, descripciones y tags.

## Pendientes de infraestructura

- Dockerfile del backend y compose de desarrollo.
- Configuración de Vercel y Render.
- CI con pruebas de backend, lint, tests y build del frontend.
- Rate limit para el asistente y CORS restringido.
