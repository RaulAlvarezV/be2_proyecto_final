import { toPublicRef } from "../utils/public-ref.js";

// Campos de los documentos relacionados que se muestran cuando el evento viene con populate.
// Del organizador solo el nombre: las rutas de eventos son públicas y el email no se expone
export const EVENT_CATEGORY_FIELDS = Object.freeze(["name"]);
export const EVENT_ORGANIZER_FIELDS = Object.freeze(["first_name", "last_name"]);

// DTO de evento: id en lugar de _id, sin campos internos, y las referencias filtradas con la misma lista blanca
export class EventDTO {
    constructor(event) {
        this.id = event._id;
        this.title = event.title;
        this.description = event.description;
        this.category = toPublicRef(event.category, EVENT_CATEGORY_FIELDS);
        this.date = event.date;
        this.location = event.location;
        this.capacity = event.capacity;
        this.availableSeats = event.capacity - (event.reservedSeats ?? 0);
        this.price = event.price;
        this.status = event.status;
        this.organizer = toPublicRef(event.organizer, EVENT_ORGANIZER_FIELDS);
    }
}
