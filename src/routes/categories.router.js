import { Router } from "express";
import { getCategories, createCategory } from "../controllers/categories.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorize.middleware.js";
import { PERMISSIONS } from "../config/permissions.js";

const router = Router();

// Consultar categorías es público (sirve para saber qué valores acepta el filtro de eventos)
router.get("/", getCategories);

// Crear categorías es una tarea administrativa
router.post("/", auth, authorizeRoles(...PERMISSIONS.MANAGE_CATEGORIES), createCategory);

export default router;
