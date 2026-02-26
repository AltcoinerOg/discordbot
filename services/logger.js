const config = require("../config");

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

    /**
     * Redacts known secrets from a message or error stack.
     * @param {string|Error} content 
     * @returns {string}
     */
    redact(content) {
        let text = typeof content === "string" ? content : (content.stack || content.message || String(content));

        for (const secret of this.secrets) {
            if (secret && secret.length > 5) {
                const escapedSecret = secret.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                const regex = new RegExp(escapedSecret, 'g');
                text = text.replace(regex, "[REDACTED]");
            }
        }
        return text;
    }

    log(...args) {
        const cleaned = args.map(arg => this.redact(arg));
        console.log(...cleaned);
    }

    error(...args) {
        const cleaned = args.map(arg => this.redact(arg));
        console.error(...cleaned);
    }

    warn(...args) {
        const cleaned = args.map(arg => this.redact(arg));
        console.warn(...cleaned);
    }
}

module.exports = new SecureLogger();
