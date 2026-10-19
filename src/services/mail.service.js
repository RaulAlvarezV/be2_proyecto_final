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

    // Devuelve true si el email salió. Sin configuración no intenta enviar (la inscripción igual es válida)
    async sendTicketConfirmation({ to, eventTitle, eventDate, eventLocation, quantity, reservationCode }) {
        if (!this.transporter) {
            return false;
        }

        const title = escapeHtml(eventTitle);
        const location = escapeHtml(eventLocation);
        const places = quantity === 1 ? "1 lugar" : `${quantity} lugares`;

        await this.transporter.sendMail({
            from: this.from,
            to,
            subject: `Inscripción confirmada: ${eventTitle}`,
            text: [
                `Tu inscripción a ${eventTitle} fue confirmada.`,
                `Fecha: ${formatDate(eventDate)}`,
                `Lugar: ${eventLocation}`,
                `Reservaste: ${places}`,
                `Código de reserva: ${reservationCode}`
            ].join("\n"),
            html: `
                <h1>Inscripción confirmada</h1>
                <p>Tu inscripción a <strong>${title}</strong> fue confirmada.</p>
                <ul>
                    <li>Fecha: ${escapeHtml(formatDate(eventDate))}</li>
                    <li>Lugar: ${location}</li>
                    <li>Reservaste: ${places}</li>
                </ul>
                <p>Código de reserva: <strong>${escapeHtml(reservationCode)}</strong></p>
            `
        });

        return true;
    }
}

export const mailService = new MailService(transporter, env.MAIL_FROM);
