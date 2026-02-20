const express = require("express");
const router = express.Router();
const config = require("../../config");

// Middleware: Authenticate requests using API secret
function authenticate(req, res, next) {
    const secret = req.headers["x-api-secret"];
    if (!secret || secret !== config.API.API_SECRET) {
        return res.status(401).json({ error: "Unauthorized: Invalid or missing API secret." });
    }
    next();
}

module.exports = (client) => {
    /**
     * GET /health
     * Public endpoint. Returns bot status.
     */
    router.get("/health", (req, res) => {
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
    router.get("/stats", (req, res) => {
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
     * Body: { channelId: string, content: string }
     */
    router.post("/message", authenticate, async (req, res) => {
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
