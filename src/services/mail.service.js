import { transporter } from "../config/mailer.config.js";
import { env } from "../config/env.js";

const TIME_ZONE = "America/Argentina/Buenos_Aires";

// Los datos del evento los cargan los organizadores: se escapan antes de meterlos en el HTML del email
function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;")
        .replaceAll("'", "&#39;");
}

function formatDate(date) {
    return new Date(date).toLocaleString("es-AR", { timeZone: TIME_ZONE, dateStyle: "full", timeStyle: "short" });
}

export class MailService {
    constructor(transporter, from) {
        this.transporter = transporter;
        this.from = from;
    }

    // Arma y envía un aviso sobre un ticket. Devuelve true si el email salió.
    // Sin configuración no intenta enviar: la operación (inscripción o cancelación) igual es válida
    async sendTicketMail({ heading, summary, to, eventTitle, eventDate, eventLocation, quantity, reservationCode }) {
        if (!this.transporter) {
            return false;
        }

        const places = quantity === 1 ? "1 lugar" : `${quantity} lugares`;

        await this.transporter.sendMail({
            from: this.from,
            to,
            subject: `${heading}: ${eventTitle}`,
            text: [
                summary(eventTitle),
                `Fecha: ${formatDate(eventDate)}`,
                `Lugar: ${eventLocation}`,
                `Lugares: ${places}`,
                `Código de reserva: ${reservationCode}`
            ].join("\n"),
            html: `
                <h1>${escapeHtml(heading)}</h1>
                <p>${summary(`<strong>${escapeHtml(eventTitle)}</strong>`)}</p>
                <ul>
                    <li>Fecha: ${escapeHtml(formatDate(eventDate))}</li>
                    <li>Lugar: ${escapeHtml(eventLocation)}</li>
                    <li>Lugares: ${places}</li>
                </ul>
                <p>Código de reserva: <strong>${escapeHtml(reservationCode)}</strong></p>
            `
        });

        return true;
    }

    async sendTicketConfirmation(data) {
        return this.sendTicketMail({
            ...data,
            heading: "Inscripción confirmada",
            summary: title => `Tu inscripción a ${title} fue confirmada.`
        });
    }

    async sendTicketCancellation(data) {
        return this.sendTicketMail({
            ...data,
            heading: "Inscripción cancelada",
            summary: title => `Tu inscripción a ${title} fue cancelada y los lugares quedaron libres.`
        });
    }
}

export const mailService = new MailService(transporter, env.MAIL_FROM);
