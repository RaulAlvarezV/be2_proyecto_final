# Plataforma de Torneos y Clínicas de Hockey

Proyecto final de Backend II (Coderhouse). API REST para gestionar torneos y clínicas de hockey sobre césped: usuarios, eventos, categorías e inscripciones.

Esta versión corresponde a la **Pre-entrega 1**: la base arquitectónica del proyecto, organizada por capas y lista para sumar autenticación, roles y la gestión completa de eventos en las próximas entregas.

## Temática

La plataforma permite que clubes y entrenadores publiquen **torneos** y **clínicas técnicas** de hockey, y que los jugadores se inscriban.

| Rol | Quién es | Qué va a poder hacer |
| --- | --- | --- |
| `admin` | Administración de la plataforma | Gestionar usuarios, categorías, eventos e inscripciones |
| `organizer` | Club, entrenador o academia | Crear y administrar sus torneos y clínicas |
| `user` | Jugador o jugadora | Consultar eventos e inscribirse |

Entidades principales: `User`, `Event`, `Category` y `Registration` (la inscripción de un jugador a un torneo o clínica).

## Tecnologías

- Node.js
- Express
- MongoDB + Mongoose
- dotenv
- Módulos ESM (`import` / `export`)

Próximas entregas: bcrypt, JWT, cookie-parser, Passport y Nodemailer.

## Instalación

```bash
git clone https://github.com/RaulAlvarezV/be2_proyecto_final.git
cd be2_proyecto_final
npm install
```

## Variables de entorno

Copiar `.env.example` como `.env` y completar los valores:

```
PORT=8080
NODE_ENV=development
MONGO_URL=mongodb://localhost:27017/be2_proyecto_final
JWT_SECRET=
```

| Variable | Descripción |
| --- | --- |
| `PORT` | Puerto del servidor (por defecto 8080) |
| `NODE_ENV` | Entorno de ejecución (`development` / `production`) |
| `MONGO_URL` | Cadena de conexión a MongoDB (local o Atlas) |
| `JWT_SECRET` | Clave para firmar los tokens (se usa a partir de la próxima entrega) |

El archivo `.env` no se sube al repositorio.

## Ejecución

```bash
# desarrollo (se reinicia al guardar cambios)
npm run dev

# producción
npm start
```

## Estructura de carpetas

```
src/
├── app.js              # configura Express (middlewares y rutas), no levanta el servidor
├── server.js           # levanta el servidor y conecta la base de datos
├── config/
│   ├── env.js          # lectura de variables de entorno con dotenv
│   └── db.js           # conexión a MongoDB
├── routes/             # endpoints
│   ├── health.router.js
│   ├── events.router.js
│   └── sessions.router.js
├── controllers/        # reciben la request y devuelven la response
├── services/           # lógica de negocio
├── repositories/       # organizan las operaciones de datos
├── dao/                # acceso a la persistencia (Mongoose)
├── models/
│   ├── User.js
│   └── Event.js
├── middlewares/        # rutas no encontradas y manejo global de errores
└── utils/              # funciones reutilizables (hash, jwt, etc.)
```

Flujo de una petición:

```
Route → Controller → Service → Repository → DAO → Model → MongoDB
```

## Rutas disponibles

| Método | Ruta | Descripción | Estado |
| --- | --- | --- | --- |
| GET | `/api/health` | Verifica que el servidor esté activo | Disponible |
| GET | `/api/events` | Lista de torneos y clínicas | Disponible |
| POST | `/api/sessions/register` | Registro de usuario | Próxima entrega (responde 501) |
| POST | `/api/sessions/login` | Inicio de sesión | Próxima entrega (responde 501) |
| GET | `/api/sessions/current` | Usuario logueado | Próxima entrega (responde 501) |
| POST | `/api/sessions/logout` | Cierre de sesión | Próxima entrega (responde 501) |

### Ejemplos

`GET /api/health` → `200`

```json
{ "status": "ok", "message": "Servidor activo" }
```

`GET /api/events` → `200` (lista vacía al inicio)

```json
{ "status": "success", "payload": [] }
```

Ruta inexistente → `404`

```json
{ "status": "error", "message": "Ruta no encontrada" }
```
