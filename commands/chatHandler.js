const { handlePersonality } = require("../core/personalityEngine");
const { getChatResponse, getMemorySummary } = require("../services/aiService");
const config = require("../config");
const stateManager = require("../services/stateManager");

// Store cooldowns locally for now as they are ephemeral
const cooldown = {};

async function handleChat(message) {
    const guildId = message.guild.id;
    const userId = message.author.id;

    // 1. COOLDOWN
    if (!cooldown[guildId]) cooldown[guildId] = {};
    const now = Date.now();
    const userCooldown = cooldown[guildId][userId] || 0;

    if (now - userCooldown < config.TIMINGS.USER_COOLDOWN) {
        return message.reply("Arre thoda ruk 😅 processing chal raha hai.");
    }
    cooldown[guildId][userId] = now;

    // 2. STATE & MEMORY
    const personalityData = stateManager.getPersonality(guildId, userId);
    const userMemory = stateManager.getMemory(guildId, userId);

    const userMessage = message.content
        .replace(`<@${message.client.user.id}>`, "")
        .replace(`<@!${message.client.user.id}>`, "")
        .trim();

    if (!userMessage) {
        return message.reply("Haan bolo ser 😌 kya scene hai?");
    }

    if (userMessage.length > 2) {
        userMemory.recent.push({ role: "user", content: userMessage });
    }

    // 3. PERSONALITY ENGINE
    const { mood, randomStyle } = handlePersonality({
        userMessage,
        personality: { [guildId]: { [userId]: personalityData } }, // formatting for legacy compat
        guildId,
        userId
    });

    // Update personality state (engine might have mutated it, ensure it's saved)
    // Note: handlePersonality currently might mutate the object directly. 
    // Ideally, we should refactor it to return updates, but for now we rely on reference.
    stateManager.updatePersonality(guildId, userId, personalityData);

    // 4. GENERATE RESPONSE
    try {
        if (!stateManager.canMakeRequest()) {
            return message.reply("Server thoda busy hai 😅 try again in few seconds.");
        }
        stateManager.incrementRequests();

        // Prepare Messages
        const raidState = stateManager.getRaidState();

        const botReplyRaw = await getChatResponse({
            userMessage,
            userMemory,
            personality: personalityData,
            raidState,
            mood,
            randomStyle
        });

        if (botReplyRaw) {
            let botReply = botReplyRaw;

            // Chaos Control
            // Limit emojis
            botReply = botReply.replace(/([\u{1F300}-\u{1FAFF}])/gu, (match, p1, offset, string) => {
                const emojiCount = (string.match(/[\u{1F300}-\u{1FAFF}]/gu) || []).length;
                return emojiCount > 2 ? "" : match;
            });

            // Remove repeated exclamation spam
            botReply = botReply.replace(/!{2,}/g, "!");

            // Trim overly long replies
            if (botReply.length > 180) botReply = botReply.slice(0, 180);

            userMemory.recent.push({ role: "assistant", content: botReply });

            // 5. SMART MEMORY COMPRESSION
            if (userMemory.recent.length > 6) {
                // We will run summary in background
                const oldSummary = userMemory.summary;
                const recent = userMemory.recent;

                // Call summary generation (detached from main reply flow to be fast)
                getMemorySummary(oldSummary, recent).then(newSummary => {
                    stateManager.updateMemorySummary(guildId, userId, newSummary);
                });

                // Truncate locally
                userMemory.recent = userMemory.recent.slice(-4);
            }

            return message.reply(botReply);

        } else {
            return message.reply("AI thoda confuse ho gaya 😅");
        }

    } catch (error) {
        console.error(error);
        return message.reply("AI server busy lag raha hai 😅");
    } finally {
        stateManager.decrementRequests();
    }
}

module.exports = { handleChat };
