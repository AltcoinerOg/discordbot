const express = require("express");
const router = express.Router();
const config = require("../../config");
const crypto = require("crypto");

// In-memory rate limiter for API endpoints
const apiRateLimit = {};
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_REQUESTS = 10;

function rateLimiter(req, res, next) {
    const ip = req.ip || req.headers["x-forwarded-for"] || "unknown";
    const now = Date.now();

    if (!apiRateLimit[ip]) {
        apiRateLimit[ip] = { count: 1, reset: now + RATE_LIMIT_WINDOW };
    } else {
        if (now > apiRateLimit[ip].reset) {
            apiRateLimit[ip] = { count: 1, reset: now + RATE_LIMIT_WINDOW };
        } else {
            apiRateLimit[ip].count++;
        }
    }

    if (apiRateLimit[ip].count > MAX_REQUESTS) {
        return res.status(429).json({ error: "Too many requests. Try again later." });
    }
    next();
}

// Middleware: Authenticate requests using timing-safe comparison
function authenticate(req, res, next) {
    const providedSecret = req.headers["x-api-secret"];
    const expectedSecret = config.API.API_SECRET;

    if (!providedSecret) {
        return res.status(401).json({ error: "Unauthorized: Missing API secret." });
    }

    try {
        // Timing-safe comparison to prevent timing attacks
        const providedBuffer = Buffer.from(providedSecret);
        const expectedBuffer = Buffer.from(expectedSecret);

        if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
            return res.status(401).json({ error: "Unauthorized: Invalid API secret." });
        }
    } catch (err) {
        return res.status(401).json({ error: "Unauthorized: Secret verification failed." });
    }

    next();
}

module.exports = (client) => {
    /**
     * GET /health
     * Public endpoint. Returns bot status.
     */
    router.get("/health", rateLimiter, (req, res) => {
        const isReady = client.isReady();
        res.status(isReady ? 200 : 503).json({
            status: isReady ? "ok" : "unavailable",
            timestamp: new Date().toISOString(),
        });
    });

    /**
     * GET /stats
     * Public endpoint. Returns bot statistics.
     */
    router.get("/stats", rateLimiter, (req, res) => {
        if (!client.isReady()) {
            return res.status(503).json({ error: "Bot is not ready yet." });
        }
        res.json({
            tag: client.user.tag,
            id: client.user.id,
            guilds: client.guilds.cache.size,
            ping: client.ws.ping,
            uptime: Math.floor(client.uptime / 1000), // in seconds
        });
    });

    /**
     * POST /message
     * Protected endpoint. Sends a message to a Discord channel.
     */
    router.post("/message", rateLimiter, authenticate, async (req, res) => {
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
