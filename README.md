# JobAgent Dashboard

Panel web para revisar las ofertas encontradas por el backend de JobAgent antes de decidir una candidatura.

## Funcionalidades

- Filtros, paginación y detalle de ofertas.
- Scores por perfil, motivo de encaje, idioma, notas y fechas.
- Revisión manual de estado y notas; se simula localmente cuando se usan mocks.
- Acciones según el tipo de candidatura: preparar solicitud sencilla o abrir una oferta externa.
- Borrado lógico mediante la API y datos simulados cuando el backend no está disponible.

## Arquitectura

Astro renderiza la interfaz y los módulos de `src/scripts/dashboard` separan API, DOM, controlador, tipos y renderizado. El frontend consume `GET`, `DELETE` y tiene preparado el contrato `PATCH /ofertas/{id}` del backend JobAgent.

## Ejecución local

```sh
cp .env.example .env
pnpm install
pnpm dev
```

`PUBLIC_API_BASE_URL` define la API y por defecto es `http://localhost:8000/api/v1`. Si no está disponible, el dashboard muestra `public/data/ofertas.json` para permitir trabajar sin backend.

## Stack

Astro, TypeScript, CSS nativo y FastAPI (backend JobAgent).

## Roadmap

- Conectar la preparación y envío real de solicitudes.
- Persistir notas y estado mediante PATCH.
- Añadir modalidad de trabajo cuando la API la exponga.
