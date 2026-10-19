import { categoriesService } from "../services/categories.service.js";

export async function getCategories(_req, res, next) {
    try {
        const categories = await categoriesService.getAll();
        res.status(200).json({ status: "success", payload: categories });
    } catch (error) {
        next(error);
    }
}

// Ya pasó por auth y authorizeRoles: req.user es admin
export async function createCategory(req, res, next) {
    try {
        const newCategory = await categoriesService.create(req.body);
        res.status(201).json({ status: "success", payload: newCategory });
    } catch (error) {
        next(error);
    }
}
