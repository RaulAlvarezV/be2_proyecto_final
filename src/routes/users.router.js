import { Router } from "express";
import { getUsers, changeUserRole } from "../controllers/users.controller.js";
import { auth } from "../middlewares/auth.middleware.js";
import { authorizeRoles } from "../middlewares/authorize.middleware.js";
import { PERMISSIONS } from "../config/permissions.js";

const router = Router();

// Rutas administrativas: todas exigen sesión (401) y rol admin (403)
router.use(auth, authorizeRoles(...PERMISSIONS.MANAGE_USERS));

router.get("/", getUsers);
router.patch("/:uid/role", changeUserRole);

export default router;
