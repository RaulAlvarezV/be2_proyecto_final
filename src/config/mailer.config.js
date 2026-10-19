import nodemailer from "nodemailer";
import { env } from "./env.js";

// Con el puerto 465 la conexión es segura desde el inicio; con 587 (u otro) se usa STARTTLS
const SECURE_PORT = 465;

// Las credenciales salen siempre del .env (ver .env.example), nunca del código
export const isMailConfigured = Boolean(env.MAIL_HOST && env.MAIL_PORT && env.MAIL_USER && env.MAIL_PASS && env.MAIL_FROM);

export const transporter = isMailConfigured
    ? nodemailer.createTransport({
        host: env.MAIL_HOST,
        port: Number(env.MAIL_PORT),
        secure: Number(env.MAIL_PORT) === SECURE_PORT,
        auth: {
            user: env.MAIL_USER,
            pass: env.MAIL_PASS
        }
    })
    : null;
