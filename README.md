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

## Estructura principal

- `app/page.tsx`: página principal del dashboard
- `components/Header.tsx`: encabezado de panel
- `components/Sidebar.tsx`: menú lateral y estado del sistema
- `app/globals.css`: estilos globales con Tailwind

## Próximos pasos

1. Conectar con tu API y base de datos.
2. Añadir autenticación y gestión de usuarios.
3. Crear formularios para gestión de facturas y pagos.
