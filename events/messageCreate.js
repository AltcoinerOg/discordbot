const { routeMessage } = require("../core/router");
const { handleModeration } = require("../core/moderation");
const { handleAutonomousSystem } = require("../core/autonomousSystem");
const stateManager = require("../services/stateManager");
const config = require("../config");

// Command Handlers
const { handleCrypto } = require("../commands/cryptoHandler");
const { handleChat } = require("../commands/chatHandler");
const { handleNews, handleWatchlist } = require("../commands/newsHandler");
const { getAutonomousReply } = require("../services/aiService");

module.exports = {
    name: "messageCreate",
    async execute(message) {
        if (message.author.bot) return;

        // Command processing
        const prefix = "!";
        const args = message.content.slice(prefix.length).trim().split(/ +/);
        const command = args.shift()?.toLowerCase();
        const isCommand = message.content.startsWith(prefix);

        if (isCommand && command === "watchlist") {
            return handleWatchlist(message, args);
        }



        // 2. MODERATION
        const modResult = handleModeration(message);
        if (modResult.blocked) return;

        // 3. INTENT DETECTION
        const raidState = stateManager.getRaidState();
        const intent = routeMessage({
            message,
            context: {
                content: message.content,
                raidState,
                mentioned: message.mentions.has(message.client.user)
            }
        });

        // 4. ROUTING
        if (intent === "crypto") {
            return handleCrypto(message);
        }

        if (intent === "news") {
            return handleNews(message);
        }

        if (intent === "ai") {
            return handleChat(message);
        }

        // 5. AUTONOMOUS SYSTEM & REPLIES
        const content = message.content.toLowerCase();
        const botAliases = ["bot", "Altys Slave", "bote", "slave"];
        const botDiscussed = botAliases.some(alias => content.includes(alias));

        const { shouldRespond } = handleAutonomousSystem(message);
        const isReply = message.reference;

        const seriousKeywords = ["scam", "hack", "wallet drained", "death", "suicide", "emergency", "ban", "warning", "report"];
        const isSerious = seriousKeywords.some(word => message.content.toLowerCase().includes(word));

        if (
            shouldRespond &&
            !isReply &&
            !isSerious &&
            !raidState.active &&
            (botDiscussed || (message.mentions.users.size === 0 && Math.random() < 0.02))
        ) {
            if (message.content.length < 3) return;

            // Global autonomous throttle
            const nowTime = Date.now();
            if (nowTime - (module.exports.lastAutonomousReply || 0) < config.TIMINGS.AUTONOMOUS_COOLDOWN) return;
            module.exports.lastAutonomousReply = nowTime;

            try {
                if (!stateManager.canMakeRequest()) return;
                stateManager.incrementRequests();

                const content = await getAutonomousReply(message.content);

                if (content) {
                    // HUMAN-LIKE DELAY
                    await message.channel.sendTyping();
                    const delay = Math.min(Math.max(content.length * 50, 1500), 4000);
                    await new Promise(res => setTimeout(res, delay));

                    await message.reply(content);
                }
            } catch (err) {
                console.error("Autonomous reply error:", err);
            } finally {
                stateManager.decrementRequests();
            }
        }
    }
};
