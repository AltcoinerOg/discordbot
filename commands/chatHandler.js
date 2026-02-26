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

    // 2.5 CREATOR & MENTIONS DETECTION
    const isCreator = (userId === config.API.CREATOR_ID);
    const mentionedUsers = message.mentions.users.filter(u => u.id !== message.client.user.id);
    let mentionedCreator = false;
    const mentionedUsersContext = [];

    for (const [id, user] of mentionedUsers) {
        if (id === config.API.CREATOR_ID) mentionedCreator = true;

        const mContext = stateManager.getMemory(guildId, id);
        const pContext = stateManager.getPersonality(guildId, id);
        mentionedUsersContext.push({
            id,
            tag: user.tag,
            displayName: user.username,
            summary: mContext.summary,
            personality: pContext
        });
    }

    if (!userMessage) {
        if (isCreator) return message.reply("Boliye my creator, how can I serve you today? 👑");
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
            randomStyle,
            isCreator,
            mentionedCreator,
            mentionedUsersContext
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
                const oldSummary = userMemory.summary;
                const recent = userMemory.recent;
                getMemorySummary(oldSummary, recent).then(newSummary => {
                    stateManager.updateMemorySummary(guildId, userId, newSummary);
                });
                userMemory.recent = userMemory.recent.slice(-4);
            }

            // HUMAN-LIKE DELAY: Show typing and wait based on message length
            await message.channel.sendTyping();
            const delay = Math.min(Math.max(botReply.length * 50, 1500), 5000); // 50ms per char, min 1.5s, max 5s
            await new Promise(res => setTimeout(res, delay));

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
