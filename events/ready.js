const { Events } = require("discord.js");
const cron = require("node-cron");
const config = require("../config");
const stateManager = require("../services/stateManager");

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        console.log(`Bot vibing as ${client.user.tag}`);

        // Load State
        stateManager.loadState();

        // RAID LOGIC moved here or can be in a separate scheduler file. 
        // For now, keeping it here to effectively replace index.js logic.

        const scheduleRaid = (channelId, timeString, greeting, duration, reminder, minHours) => {
            cron.schedule(timeString, async () => {
                const channel = await client.channels.fetch(channelId);
                if (!channel) return;

                const raidState = stateManager.getRaidState();
                stateManager.updateRaidState({
                    active: true,
                    channelId: channelId,
                    links: 0,
                    startedAt: Date.now(),
                    reminderSent: false
                });

                await channel.send(greeting);

                // 10-minute reminder
                const thisRaidStart = raidState.startedAt;
                setTimeout(async () => {
                    if (!raidState.active) return;
                    if (raidState.reminderSent) return;
                    // Check if it's still the same raid instance 
                    // (accessing via getter again to get latest state)
                    const currentRaid = stateManager.getRaidState();
                    if (currentRaid.startedAt !== thisRaidStart) return;

                    stateManager.updateRaidState({ reminderSent: true });
                    await channel.send(`⏳ <@&${config.ROLES.ASSOCIATE}>\n\nFinal 10 minutes.\n\nSubmit all valid links before closing.`);
                }, reminder);

                // End Raid
                setTimeout(async () => {
                    stateManager.updateRaidState({ active: false });
                    const currentRaid = stateManager.getRaidState();
                    const totalLinks = currentRaid.links;

                    let hours = minHours;
                    if (totalLinks >= 30) hours = 3;
                    else if (totalLinks >= 20 && minHours === 1) hours = 2;

                    await channel.send(
                        `📊 Today we have **${totalLinks} links**.\n\nComplete engagement within **${hours} hour(s)**.`
                    );
                }, duration);

            }, { timezone: "Asia/Kolkata" });
        };

        // Morning Raid
        scheduleRaid(
            config.CHANNELS.MORNING_RAID,
            "30 11 * * *",
            `🌅 <@&${config.ROLES.ASSOCIATE}>\n\nGm associates!\n\nThe morning raid party has started.\nPlease share the link within 31 minutes.\n\nLinks shared after that will be removed without notice.\nRefer to rules for engagement policies.`,
            config.TIMINGS.MORNING_RAID_DURATION,
            config.TIMINGS.MORNING_RAID_REMINDER,
            1
        );

        // Evening Raid
        scheduleRaid(
            config.CHANNELS.EVENING_RAID,
            "30 18 * * *",
            `🌆 <@&${config.ROLES.ASSOCIATE}>\n\nGood evening associates!\n\nThe evening raid party has started.\nPlease share the link within 61 minutes.\n\nLinks shared after that will be removed without notice.\nRefer to rules for engagement policies.`,
            config.TIMINGS.EVENING_RAID_DURATION,
            config.TIMINGS.EVENING_RAID_REMINDER,
            2
        );

        // Evening Raid
        scheduleRaid(
            config.CHANNELS.EVENING_RAID,
            "30 18 * * *",
            `🌆 <@&${config.ROLES.ASSOCIATE}>\n\nGood evening associates!\n\nThe evening raid party has started.\nPlease share the link within 61 minutes.\n\nLinks shared after that will be removed without notice.\nRefer to rules for engagement policies.`,
            config.TIMINGS.EVENING_RAID_DURATION,
            config.TIMINGS.EVENING_RAID_REMINDER,
            2
        );

        // --- NEXUS ELITE DAILY BRIEFING (10 AM IST) ---
        const { getTrendingNews, getTrendingCoins, getTrendingSolanaCoins, getFearGreedIndex, getTopMovers } = require("../cryptoEngine");
        const { getEliteDailyBriefing } = require("../services/aiService");

        cron.schedule("0 10 * * *", async () => {
            try {
                const alertChannelId = config.CHANNELS.ALERTS_CHANNEL;
                const channel = await client.channels.fetch(alertChannelId);
                if (!channel) return;

                if (!stateManager.canMakeRequest()) return;
                stateManager.incrementRequests();

                // Aggregate Data
                const [news, coins, fng, movers, solana] = await Promise.all([
                    getTrendingNews(),
                    getTrendingCoins(),
                    getFearGreedIndex(),
                    getTopMovers(),
                    getTrendingSolanaCoins()
                ]);

                const watchlist = stateManager.getWatchlist();

                const briefing = await getEliteDailyBriefing({ news, coins, fng, movers, solana, watchlist });
                if (briefing) {
                    await channel.send(briefing);
                }
            } catch (err) {
                console.error("NEXUS Daily Briefing Error:", err);
            } finally {
                stateManager.decrementRequests();
            }
        }, { timezone: "Asia/Kolkata" });

    }
};
