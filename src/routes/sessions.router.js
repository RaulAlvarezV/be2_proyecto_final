import { Router } from "express";
import { register, login, current, logout } from "../controllers/sessions.controller.js";
import { auth, passportCall } from "../middlewares/auth.middleware.js";

const router = Router();

// La ruta solo delega en la estrategia de Passport y en el controller
router.post("/register", passportCall("register"), register);
router.post("/login", passportCall("login", { missingMessage: "Email y contraseña son obligatorios" }), login);
router.get("/current", auth, current);
router.post("/logout", logout);

export default router;
