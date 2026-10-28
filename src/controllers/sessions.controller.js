import { sessionsService } from "../services/sessions.service.js";
import { COOKIE_NAME, cookieOptions } from "../config/cookie.js";
import { CurrentUserDTO } from "../dto/user.dto.js";

// La estrategia register de Passport ya validó y creó el usuario: queda en req.user como UserDTO (sin contraseña)
export function register(req, res) {
    res.status(201).json({ status: "success", payload: req.user });
}

// La estrategia login ya validó las credenciales y dejó { id, email, role } en req.user.
// El token lo arma el service de sesiones; el controller pone la cookie y responde
export function login(req, res) {
    const token = sessionsService.createToken(req.user);

    res.cookie(COOKIE_NAME, token, cookieOptions);
    res.status(200).json({ status: "success", message: "Login correcto" });
}

// req.user lo carga el middleware auth; la respuesta sale por el DTO del usuario autenticado (id, email y role)
export function current(req, res) {
    res.status(200).json({ status: "success", payload: new CurrentUserDTO(req.user) });
}

// Borra la cookie con las mismas opciones con las que se creó (sin maxAge)
export function logout(_req, res) {
    const { maxAge: _maxAge, ...clearOptions } = cookieOptions;

    res.clearCookie(COOKIE_NAME, clearOptions);
    res.status(200).json({ status: "success", message: "Sesión cerrada" });
}
