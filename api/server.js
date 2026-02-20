const express = require("express");
const cors = require("cors");
const config = require("../config");
const routes = require("./routes/index");

/**
 * Starts the API Gateway server.
 * @param {import('discord.js').Client} client - The Discord.js client instance.
 */
function startServer(client) {
    const app = express();
    const port = config.API.API_PORT || 3000;

    // --- Middleware ---
    app.use(cors());
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // --- Request Logger ---
    app.use((req, res, next) => {
        console.log(`[API] ${req.method} ${req.path}`);
        next();
    });

    // --- Routes ---
    app.use("/", routes(client));

    // --- 404 Handler ---
    app.use((req, res) => {
        res.status(404).json({ error: "Not Found" });
    });

    // --- Global Error Handler ---
    app.use((err, req, res, next) => {
        console.error("[API] Unhandled error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    });

    // --- Start Listening ---
    app.listen(port, () => {
        console.log(`[API] Gateway running on http://localhost:${port}`);
    });
}

module.exports = { startServer };
