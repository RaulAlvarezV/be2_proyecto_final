import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { isMailConfigured } from "./config/mailer.config.js";

// Sin la clave no se pueden firmar ni verificar los tokens: el servidor no arranca.
// Se valida antes de cargar la app, porque al cargarla se crean las estrategias de Passport que la usan
if (!env.JWT_SECRET) {
    console.error("Falta la variable de entorno JWT_SECRET (ver .env.example)");
    process.exit(1);
}

// El email es una notificación: sin configurarlo el servidor arranca y las inscripciones funcionan igual
if (!isMailConfigured) {
    console.warn("Email no configurado (MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASS, MAIL_FROM): no se enviarán confirmaciones");
}

const { default: app } = await import("./app.js");

app.listen(env.PORT, () => {
    console.log("Servidor escuchando en el puerto " + env.PORT);
    connectDB()
        .then(() => console.log("Conectado a la base de datos"))
        .catch(error => console.error("Error al conectar a la base de datos", error.message));
});
