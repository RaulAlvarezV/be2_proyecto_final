import app from "./app.js";
import { env } from "./config/env.js";
import { connectDB } from "./config/db.js";

app.listen(env.PORT, () => {
    console.log("Servidor escuchando en el puerto " + env.PORT);
    connectDB()
        .then(() => console.log("Conectado a la base de datos"))
        .catch(error => console.log("Error al conectar a la base de datos", error.message));
});
