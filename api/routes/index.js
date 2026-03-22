const express = require("express");
const router = express.Router();
const config = require("../../config");
const crypto = require("crypto");
const rateLimit = require("express-rate-limit");
const logger = require("../../services/logger");

// Setup express-rate-limit to prevent memory leaks and DDoS
const apiRateLimit = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 requests per `window` (here, per minute)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { error: "Too many requests. Try again later." }
});

// Middleware: Authenticate requests using secure hashed timing-safe comparison
function authenticate(req, res, next) {
    logger.log(`[AUTH] Attempt from ${req.ip}`);
    const providedSecret = req.headers["x-api-secret"];
    const expectedSecret = config.API.API_SECRET;

    if (!providedSecret) {
        logger.warn(`[API] Auth Failed: No secret provided in headers.`);
        return res.status(401).json({ error: "Unauthorized: Missing API secret." });
    }

    try {
        const providedHash = crypto.createHash("sha256").update(providedSecret).digest();
        const expectedHash = crypto.createHash("sha256").update(expectedSecret).digest();

        if (!crypto.timingSafeEqual(providedHash, expectedHash)) {
            logger.warn(`[API] Auth Failed: Invalid secret provided.`);
            return res.status(401).json({ error: "Unauthorized: Invalid API secret." });
        }

        // logger.log(`[API] Auth Success.`); // Optional: Too noisy if kept on
    } catch (err) {
        logger.error(`[API] Auth Error: ${err.message}`);
        return res.status(401).json({ error: "Unauthorized: Secret verification failed." });
    }

    next();
}

module.exports = (client) => {
    /**
     * GET /health
     * Public endpoint. Returns bot status.
     */
    router.get("/health", apiRateLimit, (req, res) => {
        const isReady = client.isReady();
        res.status(isReady ? 200 : 503).json({
            status: isReady ? "ok" : "unavailable",
            timestamp: new Date().toISOString(),
        });
    });

    /**
     * GET /admin/stats
     * Protected endpoint. Returns detailed bot statistics.
     */
    router.get("/admin/stats", apiRateLimit, authenticate, (req, res) => {
        if (!client.isReady()) {
            return res.status(503).json({ error: "Bot is not ready yet." });
        }

        const stateManager = require("../../services/stateManager");
        const raidState = stateManager.getRaidState();
        const watchlist = stateManager.getWatchlist();
        const modState = stateManager.getModerationState();

        res.json({
            tag: client.user.tag,
            id: client.user.id,
            guilds: client.guilds.cache.size,
            ping: client.ws.ping,
            uptime: Math.floor(client.uptime / 1000),
            raid: {
                active: raidState.active,
                links: raidState.links,
                startedAt: raidState.startedAt
            },
            watchlist: watchlist.length,
            moderation: {
                strikes: Object.keys(modState.abuseStrikes || {}).length,
                blocked: Object.keys(modState.tempBlockedUsers || {}).length
            }
        });
    });

    /**
     * POST /message
     * Protected endpoint. Sends a message to a Discord channel.
     */
    router.post("/message", apiRateLimit, authenticate, async (req, res) => {
        const { channelId, content } = req.body;

        if (!channelId || !content) {
            return res.status(400).json({ error: "Missing required fields: channelId, content." });
        }

        try {
            const channel = await client.channels.fetch(channelId);
            if (!channel || !channel.isTextBased()) {
                return res.status(404).json({ error: "Channel not found or is not a text channel." });
            }
            await channel.send(content);
            res.json({ success: true, message: `Message sent to channel ${channelId}.` });
        } catch (err) {
            console.error("[API] Error sending message:", err);
            res.status(500).json({ error: "Failed to send message.", details: err.message });
        }
    });

    return router;
};
