require("dotenv").config();
const { Client, GatewayIntentBits } = require("discord.js");
const config = require("./config");
const { startServer } = require("./api/server");

// Events
const readyEvent = require("./events/ready");
const messageCreateEvent = require("./events/messageCreate");
const guildMemberAddEvent = require("./events/guildMemberAdd");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Event Registration
client.once(readyEvent.name, (...args) => readyEvent.execute(...args));
client.on(messageCreateEvent.name, (...args) => messageCreateEvent.execute(...args));
client.on(guildMemberAddEvent.name, (...args) => guildMemberAddEvent.execute(...args));

const logger = require("./services/logger");

// Global Error Handlers
process.on("unhandledRejection", (err) => {
  logger.error("Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
  logger.error("Uncaught Exception:", err);
});

client.login(config.API.DISCORD_TOKEN).then(() => {
  logger.log(`Bot logged in as ${client.user.tag}`);
}).catch(err => {
  logger.error("Login failed:", err);
});

// Start API Gateway
startServer(client);

