export function notFound(req, res, next) {
    res.status(404).json({ status: "error", message: "Ruta no encontrada" });
}

// Middleware global: los controladores le pasan los errores con next(error)
export function errorHandler(error, req, res, next) {
    const status = error.status || 500;
    const message = status === 500 ? "Error interno del servidor" : error.message;

    if (status === 500) console.log(error);

    res.status(status).json({ status: "error", message });
}
