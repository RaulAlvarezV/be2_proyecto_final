// Con populate la referencia llega como objeto con sus campos; sin populate es solo el id.
// En los dos casos se devuelve id en lugar de _id y solo los campos indicados
export function toPublicRef(value, fields) {
    const isPopulated = value !== null && typeof value === "object" && fields.some(field => field in value);
    if (!isPopulated) {
        return value;
    }

    return { id: value._id, ...Object.fromEntries(fields.map(field => [field, value[field]])) };
}
