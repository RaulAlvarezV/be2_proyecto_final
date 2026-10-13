import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";

// Sin la clave no se pueden firmar ni verificar los tokens: el servidor no arranca.
// Se valida antes de cargar la app, porque al cargarla se crean las estrategias de Passport que la usan
if (!env.JWT_SECRET) {
    console.error("Falta la variable de entorno JWT_SECRET (ver .env.example)");
    process.exit(1);
}

const { default: app } = await import("./app.js");

app.listen(env.PORT, () => {
    console.log("Servidor escuchando en el puerto " + env.PORT);
    connectDB()
        .then(() => console.log("Conectado a la base de datos"))
        .catch(error => console.error("Error al conectar a la base de datos", error.message));
});
