import { generateToken } from "../utils/jwt.js";

// La autenticación (credenciales, registro) la resuelven las estrategias de Passport.
// Este service arma la sesión: el controller solo pone la cookie y responde
export class SessionsService {
    // El token lleva los datos mínimos de la sesión: id, email y role (nunca la contraseña)
    createToken(user) {
        return generateToken({ id: user.id, email: user.email, role: user.role });
    }
}

export const sessionsService = new SessionsService();
