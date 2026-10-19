import { Router } from "express";
import { getMyTickets } from "../controllers/tickets.controller.js";
import { auth } from "../middlewares/auth.middleware.js";

const router = Router();

// Todas las rutas de tickets requieren sesión
router.use(auth);

router.get("/my-tickets", getMyTickets);

export default router;
