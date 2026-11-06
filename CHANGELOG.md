# Changelog

Todos los cambios relevantes de este proyecto se documentan en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/),
y este proyecto adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## [Unreleased]

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
