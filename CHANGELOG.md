# Changelog

Todos los cambios relevantes de este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

## [0.30.0] — 2026-11-07

### Añadido
- `GET /datasets/{id}/eda` — estadísticas descriptivas, histogramas, correlaciones, dispersión, series temporales e insights accionables.
- `GET /datasets/{id}/validation/suggestions` — reglas de validación propuestas por nombre y tipo de columna.
- `POST /datasets/{id}/validate` — evaluación de reglas (`min`, `max`, `range`, `not_null`, `unique`, `date_order`) y score de calidad en seis dimensiones.
- Módulos `dataclean/inspect.py`, `dataclean/eda.py` y `dataclean/validation.py`.
- Campo `kind` (numeric, categorical, date, text, boolean) en el perfil de columnas.

### Cambiado
- `is_identifier` ya no marca como identificador una columna numérica continua con todos sus valores únicos.
- Versión del paquete y de la API a 0.30.0.

## [0.29.0] — 2026-11-07

### Añadido
- Endpoints `GET /health`, `GET /datasets` (listado), `DELETE /datasets/{id}` y `GET /datasets/{id}/preview`.
- Parámetro `target` en `POST /datasets` para fijar explícitamente la variable objetivo.
- CORS configurable mediante `DATACLEAN_CORS_ORIGINS`.
- Límite de subida configurable con `DATACLEAN_MAX_UPLOAD_BYTES` (por defecto 50 MB).
- Retención y limpieza automática de datasets con `DATACLEAN_MAX_AGE_HOURS` y `DATACLEAN_CLEANUP_INTERVAL_SECONDS`.
- Persistencia del archivo original recibido y snapshot Parquet normalizado para conservar tipos.

### Cambiado
- El modelado se calcula siempre sobre la vista limpia, aunque el plan todavía no haya sido aceptado.
- El plan de limpieza protege la columna objetivo de eliminaciones, imputaciones, escalados, codificaciones y correlaciones.
- `accept` reconstruye el dataset desde el snapshot Parquet en lugar de releer un CSV intermedio.
- Versión del paquete y de la API a 0.29.0.

### Corregido
- Pérdida de tipos, ceros a la izquierda y fechas por el round-trip CSV en la persistencia.
- Modelado sobre datos originales en la API cuando el plan aún no estaba aplicado.
- Posibilidad de eliminar o codificar la variable objetivo y de añadir pasos de baja importancia sobre columnas inexistentes.

## [0.28.0] — 2026-11-06

### Añadido
- Visualización de barras horizontales (CSS, ancho proporcional a la importancia máxima) para las importancias agregadas (top 15) en el informe HTML.
- Estilos `.bar-row`, `.bar-label`, `.bar-track`, `.bar` y `.bar-value` en el HTML autocontenido.

### Cambiado
- Versión del paquete y de la API a 0.28.0.
- Descripción del paquete, README y esquema OpenAPI actualizados.
- ROADMAP: nueva Fase 18 — Visualización de importancias agregadas, con el ítem marcado como completado.

## [0.27.0] — 2026-11-05

### Añadido
- Agregación de importancias de variables: campo `aggregated_importances` en el informe de modelado con máximo, media y conteo de modelos para cada feature (calculado sobre modelos no baseline).
- Inclusión de la agregación en el endpoint `GET /datasets/{id}/importances`.
- Visualización de la tabla de importancias agregadas (top 15) en el informe HTML.
- Pruebas unitarias y de API que verifican la estructura y presencia de las importancias agregadas.

### Cambiado
- Versión del paquete y de la API a 0.27.0.
- Descripción del paquete, README y esquema OpenAPI actualizados.
- ROADMAP: nueva Fase 17 — Agregación de importancias de variables, con el ítem marcado como completado.

## [0.26.0] — 2026-11-04

### Añadido
- Endpoint `GET /datasets/{id}/importances` que expone de forma explícita las importancias de variables calculadas en los modelos no baseline, ya persistidas en el informe almacenado.
- Prueba de API que verifica la carga de un dataset y la recuperación de las importancias.

### Cambiado
- Versión del paquete y de la API a 0.26.0.
- Descripción del paquete, README y esquema OpenAPI actualizados.
- ROADMAP: nueva Fase 16 — Persistencia y exposición explícita de importancias, con el ítem marcado como completado.

## [0.25.0] — 2026-11-03

### Añadido
- Cuando se activan exclusiones por baja importancia (`drop_low_importance`) y se aplica el plan, el informe de modelado se actualiza reejecutando la comparación de modelos sobre el dataset limpio resultante (tras las exclusiones).
- Prueba unitaria que verifica la actualización del informe de modelado.

### Cambiado
- Versión del paquete y de la API a 0.25.0.
- Descripción del paquete, README y esquema OpenAPI actualizados.
- ROADMAP: nueva Fase 15 — Actualización del informe de modelado tras exclusiones por baja importancia, con el ítem marcado como completado.

## [0.24.0] — 2026-11-02

### Añadido
- Parámetro opcional `drop_low_importance` (CLI `--drop-low-importance`, API `drop_low_importance`) que, cuando es verdadero y se proporciona `importance_threshold`, incorpora al plan de limpieza pasos `drop_column` con razón `low_importance` para aquellas columnas cuya importancia máxima observada es inferior al umbral.
- Los pasos se añaden tras el cálculo del informe de modelado y, si el plan se aplica, se reejecuta sobre el frame original.
- Prueba unitaria `test_drop_low_importance_adds_plan_steps`.

### Cambiado
- Versión del paquete y de la API a 0.24.0.
- Descripción del paquete, README y esquema OpenAPI actualizados.
- ROADMAP: nueva Fase 14 — Integración de baja importancia en el plan, con el ítem marcado como completado.

## [0.23.0] — 2026-11-01

### Añadido
- Parámetro opcional `importance_threshold` en `compare_models`, `analyze_frame`, CLI (`--importance-threshold`) y endpoint `POST /datasets`.
- Cuando se especifica un umbral positivo, el informe de modelado incluye `low_importance_candidates`: lista de features cuya importancia máxima entre modelos no baseline es inferior al umbral (ordenada ascendentemente), con el valor de importancia máxima observado.
- Prueba unitaria `test_importance_threshold_reports_candidates`.

### Cambiado
- Versión del paquete y de la API a 0.23.0.
- Descripción del paquete, README y esquema OpenAPI actualizados.
- ROADMAP: nueva Fase 13 — Candidatos por umbral de importancia, con el ítem marcado como completado.

## [0.22.0] — 2026-10-31

### Añadido
- Extracción de importancia de variables en la comparación de modelos: coeficientes absolutos (media por clase en clasificación multiclase) para modelos lineales y `feature_importances_` para árboles de decisión.
- Las importancias se incluyen en cada modelo no baseline del informe (`feature_importances`: lista de `{feature, importance}` ordenada descendentemente, solo valores positivos).
- Visualización de las importancias (top 15) en el informe HTML bajo la sección de modelado.
- Pruebas unitarias verifican la presencia y estructura de las importancias.

### Cambiado
- Versión del paquete y de la API a 0.22.0.
- Descripción del paquete, README y esquema OpenAPI actualizados.
- ROADMAP: nueva Fase 12 — Importancia de variables, con el ítem marcado como completado.

## [0.21.0] — 2026-10-30

### Añadido
- Parámetro opcional `drop_high_correlation_threshold` en `build_cleaning_plan`, `analyze_frame`, CLI (`--drop-high-correlation-threshold`) y endpoint `POST /datasets`.
- Cuando se especifica un umbral positivo menor a 1, se identifican pares de columnas numéricas restantes cuya correlación absoluta de Pearson es superior o igual al umbral; se excluye una de ellas (preferencia por mayor tasa de faltantes, luego menor desvío estándar, luego nombre) mediante una acción `drop_column` con razón `high_correlation`.
- El paso registra la columna correlacionada, el valor de correlación y el umbral en los parámetros.
- Prueba unitaria `test_drop_high_correlation_threshold`.

### Cambiado
- Versión del paquete y de la API a 0.21.0.
- Descripción del paquete, README y esquema OpenAPI actualizados.
- ROADMAP: nueva Fase 11 — Selección de características por correlación, con el ítem de exclusión por alta correlación marcado como completado.

## [0.20.0] — 2026-10-26

### Añadido
- Parámetro opcional `drop_low_variance_threshold` en `build_cleaning_plan`, `analyze_frame`, CLI (`--drop-low-variance-threshold`) y endpoint `POST /datasets`.
- Cuando se especifica un umbral positivo, las columnas numéricas cuyo desvío estándar observado (población, sobre valores no nulos) es inferior al umbral se excluyen del plan mediante una acción `drop_column` con razón `low_variance`.
- El paso registra el desvío calculado y el umbral en los parámetros.
- Prueba unitaria `test_drop_low_variance_threshold`.

### Cambiado
- Versión del paquete y de la API a 0.20.0.
- Descripción del paquete, README y esquema OpenAPI actualizados.
- ROADMAP: nueva Fase 10 — Selección de características básica, con el ítem de exclusión por baja varianza marcado como completado.

## [0.19.0] — 2026-10-24

### Añadido
- Parámetro opcional `onehot_drop_first` en `build_cleaning_plan`, `analyze_frame` y CLI (`--onehot-drop-first`).
- Cuando es verdadero y `encode_categorical="onehot"`, se omite la primera categoría ordenada como referencia (drop_first) para evitar multicolinealidad perfecta.
- El paso de plan registra `drop_first` y `dropped_category` en los parámetros.
- Parámetro de consulta `onehot_drop_first` en `POST /datasets`.
- Prueba unitaria `test_onehot_drop_first`.

### Cambiado
- Versión del paquete y de la API a 0.19.0.
- Descripción del paquete, README y esquema OpenAPI actualizados.
- ROADMAP: nueva Fase 9 — Refinamientos de codificación, con el ítem de drop_first marcado como completado.
