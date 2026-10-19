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

    // Índice unique de MongoDB: dos altas con el mismo valor al mismo tiempo (email de usuario o nombre de categoría)
    if (error.code === DUPLICATE_KEY_CODE) {
        const message = error.keyPattern?.email ? "El email ya está registrado" : "Ya existe un registro con ese valor";
        return res.status(409).json({ status: "error", message });
    }

    // Un id que no tiene formato de ObjectId (/api/events/123): no puede existir, pero es un error del cliente
    if (error.name === "CastError" && error.kind === "ObjectId") {
        return res.status(400).json({ status: "error", message: "El id no tiene un formato válido" });
    }

    // Mongoose rechazó los datos (campo obligatorio faltante, valor fuera de rango, id mal formado): es un 400, no un 500
    if (error.name === "ValidationError" || error.name === "CastError") {
        return res.status(400).json({ status: "error", message: "Datos inválidos" });
    }

    const status = error.status || 500;

    if (status === 500) {
        // El detalle queda en la consola del servidor, nunca en la respuesta
        console.error("Error interno:", error);
        return res.status(500).json({ status: "error", message: "Error interno del servidor" });
    }

    res.status(status).json({ status: "error", message: error.message });
}
