# Plataforma de Torneos y Clínicas de Hockey

Proyecto final de Backend II (Coderhouse). API REST para gestionar torneos y clínicas de hockey sobre césped: usuarios, eventos, categorías e inscripciones.

Esta versión corresponde a la **Pre-entrega 4**: la autenticación (registro, login y usuario actual) pasa a estar **centralizada en estrategias de Passport.js**. Las rutas y sus respuestas son **las mismas que en la Pre-entrega 3** (JWT en la cookie HTTP Only `currentUser`); lo que cambia es la organización interna.

## Temática

La plataforma permite que clubes y entrenadores publiquen **torneos** y **clínicas técnicas** de hockey, y que los jugadores se inscriban.

| Rol | Quién es | Qué va a poder hacer |
| --- | --- | --- |
| `admin` | Administración de la plataforma | Gestionar usuarios, categorías, eventos e inscripciones |
| `organizer` | Club, entrenador o academia | Crear y administrar sus torneos y clínicas |
| `user` | Jugador o jugadora | Consultar eventos e inscribirse |

Todo usuario nuevo se registra con rol `user`. El rol nunca se toma del body del registro.

### Entidades

| Modelo | Qué representa |
| --- | --- |
| `User` | Usuario de la plataforma: `first_name`, `last_name`, `email` (único), `password` (hash) y `role` (`user` por defecto; `user`, `organizer` o `admin`) |
| `Event` | Torneo o clínica: nombre, tipo (`torneo` / `clinica`), fecha, lugar, cupo, precio, estado, categoría y organizador |
| `Category` | Categoría de los eventos (por ejemplo Sub 14, Sub 16, Primera, Arqueras) |
| `Registration` | Inscripción de un usuario a un evento. Un usuario no puede inscribirse dos veces al mismo evento |

## Tecnologías

- Node.js y Express
- MongoDB + Mongoose (local o MongoDB Atlas)
- dotenv
- bcrypt (hash de contraseñas)
- jsonwebtoken (JWT)
- cookie-parser (lectura de la cookie de autenticación)
- Passport.js: `passport`, `passport-local` (registro y login) y `passport-jwt` (usuario actual)
- node:test (tests automatizados, incluido en Node)
- Módulos ESM (`import` / `export`)

Próximas entregas: roles y autorización, Nodemailer.

## Autenticación con Passport

Toda la autenticación está centralizada en **`src/config/passport.config.js`**. `app.js` solo llama a `initializePassport()` y `passport.initialize()`.

| Estrategia | Tipo | Qué hace | Ruta que la usa |
| --- | --- | --- | --- |
| `register` | `passport-local` | Valida los campos, normaliza el email, controla duplicados, hashea la contraseña con bcrypt y crea el usuario con rol `user` | `POST /api/sessions/register` |
| `login` | `passport-local` | Busca al usuario por email y compara la contraseña con bcrypt. Si algo no coincide responde `Credenciales inválidas` | `POST /api/sessions/login` |
| `current` | `passport-jwt` | Lee el JWT de la cookie `currentUser`, verifica firma y vencimiento (algoritmo `HS256` fijado por el servidor) y busca al usuario por el id del token | `GET /api/sessions/current` |

- **Las rutas solo delegan:** `router.post("/login", passportCall("login"), login)`. `passportCall` ejecuta `passport.authenticate(estrategia, { session: false })` y, si la autenticación falla, responde en JSON con el código que indica la estrategia (400, 401 o 409), así el contrato de la API no cambia.
- **El JWT y la cookie los genera el controller**, no Passport: la estrategia `login` solo valida las credenciales y deja `{ id, email, role }` en `req.user`.
- **El logout no pasa por Passport:** solo borra la cookie.
- **`session: false`:** la sesión la representa el JWT en la cookie, Passport no guarda sesiones en el servidor.

### Preparado para proveedores externos (Google, GitHub)

`initializePassport()` registra cada estrategia con una función propia. Para sumar, por ejemplo, login con GitHub:

1. Instalar la estrategia (`npm install passport-github2`).
2. Agregar en `passport.config.js` una función `githubStrategy(repository)` que busque o cree el usuario local con los datos que devuelve GitHub, y llamarla dentro de `initializePassport()`.
3. Sumar al `.env` sus credenciales (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL`) y las rutas de inicio y callback en `sessions.router.js`, que también generan el JWT propio de la API en el controller.

No hace falta tocar `app.js`: ya inicializa Passport y registra todo lo que esté en `initializePassport()`.

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
JWT_EXPIRES_IN=1h
```

| Variable | Descripción |
| --- | --- |
| `PORT` | Puerto del servidor (por defecto 8080) |
| `NODE_ENV` | Entorno (`development` / `production`). En `production` la cookie se envía solo por HTTPS (`secure`) |
| `MONGO_URL` | Cadena de conexión a MongoDB (local o Atlas) |
| `JWT_SECRET` | Clave para firmar y verificar los JWT. **Obligatoria**: sin ella el servidor no arranca. Usar una clave larga y aleatoria |
| `JWT_EXPIRES_IN` | Duración del token (por defecto `1h`) |

El archivo `.env` no se sube al repositorio.

## Ejecución

```bash
# desarrollo (se reinicia al guardar cambios)
npm run dev

# producción
npm start

# tests automatizados
npm test
```

## Estructura de carpetas

```
src/
├── app.js                       # configura Express (json, cookie-parser, Passport y rutas), no levanta el servidor
├── server.js                    # valida JWT_SECRET, carga la app, levanta el servidor y conecta la base
├── config/
│   ├── env.js                   # variables de entorno con dotenv
│   ├── db.js                    # conexión a MongoDB
│   ├── cookie.js                # nombre y opciones de la cookie currentUser
│   └── passport.config.js       # estrategias register, login y current (initializePassport)
├── routes/
│   ├── health.router.js
│   ├── events.router.js
│   └── sessions.router.js       # las rutas delegan en las estrategias de Passport
├── controllers/
│   ├── health.controller.js
│   ├── events.controller.js
│   └── sessions.controller.js   # responde, genera el token y maneja la cookie
├── services/
│   └── events.service.js
├── repositories/
│   ├── events.repository.js
│   └── users.repository.js
├── dao/
│   ├── events.dao.js
│   └── users.dao.js
├── models/
│   ├── User.js
│   ├── Event.js
│   ├── Category.js
│   └── Registration.js
├── middlewares/
│   ├── auth.middleware.js       # passportCall y auth (estrategia current) para las rutas protegidas
│   └── error.middleware.js      # rutas no encontradas y manejo global de errores
└── utils/
    ├── jwt.js                   # generateToken y verifyToken
    └── hash.js                  # createHash e isValidPassword (bcrypt)
tests/
├── passport.strategies.test.js  # estrategias register, login y current con un repository falso (sin MongoDB)
└── jwt.test.js                  # helper de JWT
```

Flujo del login y de una petición protegida:

```
POST /api/sessions/login
  → sessions.router.js
  → passportCall("login")        (estrategia login de passport.config.js → req.user = { id, email, role })
  → sessions.controller.js       (genera el JWT y setea la cookie currentUser)

GET /api/sessions/current
  → sessions.router.js
  → auth = passportCall("current")  (estrategia current: cookie → JWT → usuario → req.user)
  → sessions.controller.js          (responde { id, email, role })
```

## Rutas

| Método | Ruta | Descripción | Acceso |
| --- | --- | --- | --- |
| GET | `/api/health` | Verifica que el servidor esté activo | Público |
| GET | `/api/events` | Lista de torneos y clínicas | Público |
| POST | `/api/sessions/register` | Registro seguro de usuario | Público |
| POST | `/api/sessions/login` | Inicio de sesión: genera el JWT y lo guarda en la cookie `currentUser` | Público |
| GET | `/api/sessions/current` | Datos del usuario autenticado | **Requiere cookie** |
| POST | `/api/sessions/logout` | Cierra la sesión borrando la cookie | Público |

### `POST /api/sessions/register`

| Campo | Tipo | Reglas |
| --- | --- | --- |
| `first_name` | texto | Obligatorio, no vacío |
| `last_name` | texto | Obligatorio, no vacío |
| `email` | texto | Obligatorio, formato válido, único. Se guarda sin espacios y en minúsculas |
| `password` | texto | Obligatorio, mínimo 8 caracteres, no puede ser solo espacios. Se guarda hasheada con bcrypt |

Request:

```json
{ "first_name": "Ana", "last_name": "Pérez", "email": "Ana@Mail.com ", "password": "Secreta123" }
```

Response `201`:

```json
{ "status": "success", "payload": { "id": "665f2a...", "first_name": "Ana", "last_name": "Pérez", "email": "ana@mail.com", "role": "user" } }
```

| Código | Mensaje | Cuándo |
| --- | --- | --- |
| `400` | `Faltan campos obligatorios` | Falta algún campo |
| `400` | `Formato de email inválido` | Email mal escrito |
| `400` | `La contraseña debe tener al menos 8 caracteres` | Contraseña corta |
| `400` | `La contraseña no puede estar vacía` | Contraseña de solo espacios |
| `400` | `Los campos deben ser texto` | Algún campo no es texto |
| `400` | `El nombre y el apellido no pueden estar vacíos` | Nombre o apellido con solo espacios |
| `409` | `El email ya está registrado` | Email repetido (aunque cambien mayúsculas o espacios) |

### `POST /api/sessions/login`

Request:

```json
{ "email": "ana@mail.com", "password": "Secreta123" }
```

Response `200` (además setea la cookie `currentUser`):

```json
{ "status": "success", "message": "Login correcto" }
```

La cookie `currentUser` guarda el JWT con estas opciones:

| Opción | Valor | Para qué |
| --- | --- | --- |
| `httpOnly` | `true` | JavaScript del navegador no puede leerla (protege de XSS) |
| `sameSite` | `"lax"` | No se envía en peticiones que vienen de otros sitios (CSRF) |
| `maxAge` | `3600000` | Dura 1 hora |
| `secure` | `true` solo en producción | Solo viaja por HTTPS |

El JWT se firma con `JWT_SECRET`, vence según `JWT_EXPIRES_IN` y su payload tiene **solo** `{ id, email, role }`: nunca la contraseña. El token no se devuelve en el body.

| Código | Mensaje | Cuándo |
| --- | --- | --- |
| `400` | `Email y contraseña son obligatorios` | Falta el email o la contraseña |
| `401` | `Credenciales inválidas` | El email no existe **o** la contraseña no coincide. Es el mismo mensaje a propósito, para no revelar qué dato falló |

### `GET /api/sessions/current`

Protegida por el middleware `auth`, que ejecuta la **estrategia `current` de Passport**: lee la cookie `currentUser`, verifica el JWT, busca al usuario por el id del token y deja `{ id, email, role }` en `req.user`.

Response `200` (con la cookie):

```json
{ "status": "success", "payload": { "id": "665f2a...", "email": "ana@mail.com", "role": "user" } }
```

| Código | Mensaje | Cuándo |
| --- | --- | --- |
| `401` | `No autenticado` | No llega la cookie (sin login o después del logout) |
| `401` | `Token inválido o expirado` | El token fue alterado, está mal formado, vencido o firmado con otra clave |

### `POST /api/sessions/logout`

Borra la cookie `currentUser`. Response `200`:

```json
{ "status": "success", "message": "Sesión cerrada" }
```

### Otras rutas

`GET /api/health` → `200`

```json
{ "status": "ok", "message": "Servidor activo" }
```

`GET /api/events` → `200`

```json
{ "status": "success", "payload": [] }
```

Ruta inexistente → `404`

```json
{ "status": "error", "message": "Ruta no encontrada" }
```

## Cómo probar el flujo completo

En **Postman** (guarda y envía la cookie automáticamente), con el servidor en marcha:

1. **POST** `http://localhost:8080/api/sessions/register` con el body de ejemplo → `201`.
2. **POST** `http://localhost:8080/api/sessions/login` con email y contraseña → `200`. En la pestaña **Cookies** de la respuesta aparece `currentUser` (HttpOnly).
3. **GET** `http://localhost:8080/api/sessions/current` → `200` con `{ id, email, role }`.
4. **POST** `http://localhost:8080/api/sessions/logout` → `200 Sesión cerrada`.
5. **GET** `/api/sessions/current` otra vez → `401 No autenticado`.

Para ver los errores del login: repetir el paso 2 con un email que no existe y después con una contraseña incorrecta. Las dos respuestas son iguales: `401 Credenciales inválidas`.

## Tests automatizados

```bash
npm test
```

18 tests con `node:test` (incluido en Node, sin dependencias extra). No necesitan MongoDB: las estrategias se registran con un **repository falso en memoria** (`initializePassport(repositoryFalso)`), aprovechando la inyección de dependencias, y se ejecutan a través de `passportCall`, igual que en la app.

| Archivo | Qué prueba |
| --- | --- |
| `tests/passport.strategies.test.js` | **register:** éxito sin contraseña en la respuesta, hash bcrypt, rol ignorado, duplicado (409), campos faltantes, inválidos o de solo espacios (400). **login:** éxito con `{ id, email, role }` y el mismo 401 para email inexistente y contraseña incorrecta. **current:** token válido, sin cookie, alterado, mal formado, vencido, de otra clave, sin firma (`alg: none`) y usuario inexistente |
| `tests/jwt.test.js` | Helper de JWT: payload, expiración y token alterado |

## Evidencias

### Login, current y logout (Pre-entrega 3)

**Login:** responde `200 Login correcto` y setea la cookie `currentUser` con `Max-Age=3600`, `HttpOnly` y `SameSite=Lax` (sin `Secure` porque corre en desarrollo, por `http`).

![Login con la cookie currentUser en los headers de la respuesta](docs/evidencias/login-cookie.png)

**`/current` con la cookie:** responde `200` con `{ id, email, role }`, sin la contraseña. El `id` es el mismo del usuario registrado en la Pre-entrega 2.

![GET /api/sessions/current con la cookie respondiendo 200](docs/evidencias/current-200.png)

**`/current` sin cookie:** después del logout la cookie ya no está, y la ruta protegida responde `401 No autenticado`.

![GET /api/sessions/current sin cookie respondiendo 401](docs/evidencias/current-401.png)

### Registro (Pre-entrega 2)

**Registro exitoso en Postman:** el email llega como `"Ana@Mail.com "` y se guarda normalizado como `ana@mail.com`, con rol `user`. La respuesta no incluye la contraseña.

![Registro exitoso en Postman con respuesta 201 sin password](docs/evidencias/registro-postman-201.png)

**Usuario guardado en MongoDB Compass:** el mismo usuario (`_id` `6ac503bc13597b7ed91711a8`, igual al `id` de la respuesta) tiene la contraseña hasheada con bcrypt (`$2b$10$...`), nunca en texto plano.

![Usuario en MongoDB Compass con la contraseña hasheada](docs/evidencias/password-hasheado-compass.png)
