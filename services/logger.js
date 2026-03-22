const config = require("../config");
const winston = require("winston");

// --- Structured Logging (Winston) ---
const logger = winston.createLogger({
    level: "info",
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(
                winston.format.colorize(),
                winston.format.simple()
            )
        })
    ]
});

/**
 * A utility to redact sensitive secrets from strings before logging.
 */
class SecureLogger {
    constructor() {
        this.secrets = [
            config.API.DISCORD_TOKEN,
            config.API.GROQ_KEY,
            config.API.API_SECRET
        ].filter(Boolean);
    }

    redact(content) {
        let text = typeof content === "string" ? content : (content.stack || content.message || JSON.stringify(content));
        for (const secret of this.secrets) {
            if (secret && secret.length > 5) {
                text = text.replace(new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), "[REDACTED]");
            }
        }
        return text;
    }

    log(...args) { logger.info(args.map(a => this.redact(a)).join(" ")); }
    error(...args) { logger.error(args.map(a => this.redact(a)).join(" ")); }
    warn(...args) { logger.warn(args.map(a => this.redact(a)).join(" ")); }
}

module.exports = new SecureLogger();

module.exports = new SecureLogger();
