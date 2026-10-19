import { Router } from "express";
import { getMyTickets, cancelTicket } from "../controllers/tickets.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { authorizeTicketOwnerOrAdmin } from "../middlewares/authorize.middleware.js";

const router = Router();

// Todas las rutas de tickets requieren sesión
router.use(auth);

router.get("/my-tickets", getMyTickets);

// Cancelar: el dueño del ticket o un admin (403 para cualquier otro)
router.patch("/:tid/cancel", authorizeTicketOwnerOrAdmin, cancelTicket);

export default router;
