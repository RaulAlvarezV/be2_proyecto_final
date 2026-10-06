const DUPLICATE_KEY_CODE = 11000;

export function notFound(_req, res, _next) {
    res.status(404).json({ status: "error", message: "Ruta no encontrada" });
}

// Middleware global: los controladores le pasan los errores con next(error)
export function errorHandler(error, _req, res, _next) {
    // Body que no es un JSON válido (lo detecta express.json)
    if (error.type === "entity.parse.failed") {
        return res.status(400).json({ status: "error", message: "El cuerpo de la petición no es un JSON válido" });
    }

    // Índice unique de MongoDB: dos registros con el mismo email al mismo tiempo
    if (error.code === DUPLICATE_KEY_CODE) {
        return res.status(409).json({ status: "error", message: "El email ya está registrado" });
    }

    const status = error.status || 500;

    if (status === 500) {
        // El detalle queda en la consola del servidor, nunca en la respuesta
        console.error("Error interno:", error);
        return res.status(500).json({ status: "error", message: "Error interno del servidor" });
    }

    res.status(status).json({ status: "error", message: error.message });
}
