// DTO de categoría: id en lugar de _id y sin campos internos (timestamps, __v)
export class CategoryDTO {
    constructor(category) {
        this.id = category._id;
        this.name = category.name;
        this.description = category.description;
    }
}
