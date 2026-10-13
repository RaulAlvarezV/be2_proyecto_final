import { env } from "./env.js";

export const COOKIE_NAME = "currentUser";
const ONE_HOUR_MS = 60 * 60 * 1000; // 3600000

export const cookieOptions = {
    httpOnly: true,                           // JavaScript del navegador no puede leerla (protege de XSS)
    sameSite: "lax",                          // no se envía en peticiones que vienen de otros sitios (CSRF)
    maxAge: ONE_HOUR_MS,
    secure: env.NODE_ENV === "production"     // solo por HTTPS en producción; en local se usa http
};
