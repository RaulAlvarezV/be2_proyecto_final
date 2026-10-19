// Error con código de estado para que el middleware global sepa qué responder
export class AppError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}
