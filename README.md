# JobAgent Dashboard

Interfaz web para revisar y gestionar las ofertas detectadas por el backend de JobAgent. Permite filtrar las candidaturas, consultar su información y avanzar las ofertas de LinkedIn Easy Apply por el flujo de análisis, extracción de preguntas y generación de respuestas.

## Estado actual

El dashboard consume una API de JobAgent ya existente; no incluye el backend ni ejecuta modelos localmente. La URL base se configura con `PUBLIC_API_BASE_URL` y, si no se indica, es `http://127.0.0.1:8000/api/v1`.

Actualmente ofrece:

- Listado paginado, filtros por empresa, estado, perfil, puntuación y tipo de solicitud.
- Página de estadísticas con embudo de estados, trabajo pendiente, encaje, Easy Apply y distribuciones.
- Detalle de cada oferta: clasificación, puntuaciones, resumen, motivo de encaje, preguntas y respuestas generadas.
- Edición manual del estado y de las notas.
- Eliminación de ofertas mediante un modal de confirmación.
- Flujo asistido para ofertas Easy Apply.

No hay datos simulados como alternativa: la API debe estar disponible para cargar las ofertas.

## Flujo de una oferta

| Estado | Acción disponible | Resultado |
| --- | --- | --- |
| `extraida` | Analizar oferta | La API clasifica la oferta y la deja en `analizada`, `descartada` o `error`. |
| `analizada` (Easy Apply) | Guardar preguntas | Se extraen y guardan las preguntas; la oferta pasa a `pendientes_respuestas` o `lista_para_aplicar`. |
| `pendientes_respuestas` | Generar respuestas | La API genera respuestas para las preguntas guardadas. |
| `lista_para_aplicar` | Enviar solicitud | Abre la URL de la oferta para completar el envío en LinkedIn. |
| `aplicada`, `descartada`, `error` | — | No se muestra una acción principal. |

En ofertas que no usan Easy Apply, después del análisis se muestra **Abrir oferta**, que abre la URL original en una pestaña nueva. El envío automatizado de la solicitud no está implementado en el frontend: el último paso abre LinkedIn para que la persona usuaria lo complete.

## Requisitos

- Node.js `>= 22.12.0`.
- `pnpm`.
- Backend de JobAgent accesible desde el navegador y configurado con CORS para el origen del dashboard.

## Puesta en marcha

```sh
pnpm install
pnpm dev
```

El servidor de desarrollo se inicia normalmente en `http://localhost:4321`.

Para indicar otra URL de la API, crea un archivo `.env` en la raíz:

```dotenv
PUBLIC_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

## Scripts

| Comando | Descripción |
| --- | --- |
| `pnpm dev` | Inicia Astro en modo desarrollo. |
| `pnpm build` | Genera la versión estática de producción en `dist/`. |
| `pnpm preview` | Sirve localmente la compilación de `dist/`. |

## Endpoints utilizados

| Método | Endpoint | Uso |
| --- | --- | --- |
| `GET` | `/ofertas/` | Lista filtrada y paginada de ofertas. |
| `GET` | `/ofertas/{id}` | Detalle de una oferta. |
| `PATCH` | `/ofertas/{id}` | Actualización manual del estado. |
| `PATCH` | `/dashboard/ofertas/{id}/notas` | Guardado de notas. |
| `DELETE` | `/ofertas/{id}` | Eliminación lógica de una oferta. |
| `GET` | `/dashboard/stats` | Métricas del panel. |
| `POST` | `/agent/ofertas/procesar/{id}` | Análisis y clasificación de una oferta extraída. |
| `POST` | `/scraper/linkedin/easyapply/procesar/{id}` | Extracción y guardado de preguntas Easy Apply. |
| `POST` | `/agent/ofertas/{id}/responder` | Generación de respuestas para una oferta. |

## Estructura

```text
src/
├── pages/index.astro                # Estructura de la página
├── pages/stats.astro                # Vista de métricas del dashboard
├── scripts/dashboard/
│   ├── api.ts                       # Cliente HTTP de la API
│   ├── controller.ts                # Eventos y flujo de la aplicación
│   ├── dom.ts                       # Referencias al DOM
│   ├── render.ts                    # Renderizado de tarjetas y detalle
│   ├── stats.ts                     # Carga y presentación de estadísticas
│   └── types.ts                     # Tipos del dominio
└── styles/dashboard.css             # Estilos del panel
```

## Stack

- Astro 7
- TypeScript
- CSS nativo
- API FastAPI de JobAgent
