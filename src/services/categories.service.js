import { categoriesRepository } from "../repositories/categories.repository.js";
import { AppError } from "../utils/errors.js";

// Datos que devuelve la API (id en lugar de _id)
export function toPublicCategory(category) {
    return {
        id: category._id,
        name: category.name,
        description: category.description
    };
}

export class CategoriesService {
    constructor(repository) {
        this.repository = repository;
    }

    async getAll() {
        const categories = await this.repository.getAll();
        return categories.map(toPublicCategory);
    }

    async create(data = {}) {
        const { name, description } = data;

        if (typeof name !== "string" || name.trim() === "") {
            throw new AppError("El nombre de la categoría es obligatorio", 400);
        }

        if (description !== undefined && typeof description !== "string") {
            throw new AppError("La descripción de la categoría debe ser texto", 400);
        }

        // El nombre se guarda en minúsculas para que el filtro ?category=Workshop y ?category=workshop sean el mismo
        const normalizedName = name.trim().toLowerCase();

        // Primer control de duplicados; el índice unique del modelo cubre dos altas al mismo tiempo
        const existing = await this.repository.getByName(normalizedName);
        if (existing) {
            throw new AppError("La categoría ya existe", 409);
        }

        const newCategory = await this.repository.create({ name: normalizedName, description });
        return toPublicCategory(newCategory);
    }
}

export const categoriesService = new CategoriesService(categoriesRepository);
