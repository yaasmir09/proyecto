# Gestión de Cobranza Inteligente

Frontend en Next.js con TypeScript y Tailwind CSS para un panel profesional de cobranza.

## Comandos

- `npm install`
- `npm run dev`
- `npm run build`
- `npm run start`

## Ejecutar con Docker Desktop

Con Docker Desktop abierto, ejecuta en la raíz del proyecto:

```bash
docker compose up --build
```

La aplicación estará disponible en `http://localhost:3001` y PostgreSQL en el puerto `5432`.
El esquema se crea automáticamente la primera vez y los datos quedan guardados en el volumen `postgres_data`.

Para detener los servicios:

```bash
docker compose down
```

Para eliminar también los datos de PostgreSQL, usa `docker compose down -v`.

## Arquitectura de microservicios

Docker Compose levanta cinco contenedores:

- `app`: frontend Next.js y gateway compatible con `/api/*`.
- `auth`: login, usuarios y roles.
- `reports`: cinco reportes de cartera.
- `backup`: creación y restauración de respaldos PostgreSQL.
- `db`: PostgreSQL 16.

Los servicios internos se comunican por la red de Compose. El frontend sigue usando las mismas rutas públicas, por lo que no cambia su contrato. Las operaciones de clientes, facturas, pagos, préstamos, contratos y seguimientos permanecen temporalmente en `app` como dominio de cobranza; pueden extraerse después a un `cobranza-service` sin modificar la interfaz.

## Estructura principal

- `app/page.tsx`: página principal del dashboard
- `components/Header.tsx`: encabezado de panel
- `components/Sidebar.tsx`: menú lateral y estado del sistema
- `app/globals.css`: estilos globales con Tailwind
- `services/auth/server.mjs`: microservicio de autenticación
- `services/reports/server.mjs`: microservicio de reportes
- `services/backup/server.mjs`: microservicio de base de datos

## Ejecutar

```bash
docker compose up --build
```

La aplicación queda disponible en `http://localhost:3001`. Para detenerla usa `docker compose down`.
