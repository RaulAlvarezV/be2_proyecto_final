import { generateToken } from "../utils/jwt.js";
import { COOKIE_NAME, cookieOptions } from "../config/cookie.js";

// La estrategia register de Passport ya validó y creó el usuario: queda en req.user (sin contraseña)
export function register(req, res) {
    res.status(201).json({ status: "success", payload: req.user });
}

// La estrategia login ya validó las credenciales y dejó { id, email, role } en req.user.
// El token y la cookie los genera el controller, no Passport
export function login(req, res) {
    const token = generateToken(req.user);

    res.cookie(COOKIE_NAME, token, cookieOptions);
    res.status(200).json({ status: "success", message: "Login correcto" });
}

// req.user lo carga el middleware auth: solo id, email y role (nunca la contraseña)
export function current(req, res) {
    res.status(200).json({ status: "success", payload: req.user });
}

// Borra la cookie con las mismas opciones con las que se creó (sin maxAge)
export function logout(_req, res) {
    const { maxAge: _maxAge, ...clearOptions } = cookieOptions;

    res.clearCookie(COOKIE_NAME, clearOptions);
    res.status(200).json({ status: "success", message: "Sesión cerrada" });
}
