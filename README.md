# Data Companion

Quiero construir una aplicación web profesional de Data Science llamada provisionalmente DataClean AI.



El objetivo de la aplicación es permitir que un usuario cargue una base de datos desde diferentes fuentes y formatos, analizar automáticamente su calidad, detectar problemas, proponer correcciones, ejecutar una limpieza controlada y finalmente recomendar qué análisis o técnicas de Machine Learning podrían aplicarse a esos datos.



IMPORTANTE:



- Construir primero una arquitectura sólida y modular.

- No implementar todavía todas las funcionalidades avanzadas.

- Priorizar una interfaz profesional, clara y orientada a analistas de datos.

- La aplicación debe ser responsive.

- Evitar una interfaz excesivamente decorativa.

- Utilizar componentes reutilizables.

- Mantener una separación clara entre frontend, lógica de procesamiento y servicios de IA/ML.

- No inventar resultados de análisis: cuando todavía no existan datos procesados, mostrar estados vacíos o ejemplos claramente identificados como demostración.



Estructura principal



Crear un dashboard con las siguientes secciones:



1. Inicio / Dashboard

2. Cargar datos

3. Diagnóstico

4. Limpieza

5. Validación

6. Exploración / EDA

7. Machine Learning

8. Informe

9. Historial



Dashboard



Mostrar:



- Dataset actual.

- Cantidad de filas.

- Cantidad de columnas.

- Porcentaje de valores faltantes.

- Cantidad de duplicados.

- Data Quality Score.

- Estado general del dataset.

- Última operación realizada.



Si todavía no existe un dataset cargado, mostrar un estado vacío con un botón prominente:



"Analizar un dataset"



Navegación



Crear una navegación lateral:



- Dashboard

- Datos

- Calidad

- Limpieza

- EDA

- Machine Learning

- Informes

- Historial



En móvil debe convertirse en navegación adaptable.



Diseño



Utilizar un diseño tipo SaaS/Data Platform:



- Sidebar.

- Header.

- Cards para métricas.

- Tablas.

- Gráficos.

- Badges de estado.

- Alertas.

- Modales para confirmar operaciones destructivas.



La interfaz debe estar preparada para crecer posteriormente con funcionalidades de IA y Machine Learning.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a5e5ba56-6497-460e-bc4b-cc6a70d28d00).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
