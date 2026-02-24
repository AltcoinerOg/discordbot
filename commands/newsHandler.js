const { getTrendingNews, getTrendingCoins, getFearGreedIndex, getTopMovers } = require("../cryptoEngine");
const { getEnhancedNewsSummary } = require("../services/aiService");
const config = require("../config");
const stateManager = require("../services/stateManager");

async function handleNews(message) {
    const channelId = message.channel.id;

    // 1. Channel Filter
    if (!config.CHANNELS.NEWS_COMMAND_CHANNELS.includes(channelId)) {
        return;
    }

    try {
        if (!stateManager.canMakeRequest()) {
            return message.reply("Server busy 😅 try in 5 sec.");
        }
        stateManager.incrementRequests();

        await message.channel.sendTyping();

        // 2. Aggregate Data
        const [news, coins, fng, movers] = await Promise.all([
            getTrendingNews(),
            getTrendingCoins(),
            getFearGreedIndex(),
            getTopMovers()
        ]);

        // 3. Generate Summary
        const digest = await getEnhancedNewsSummary({ news, coins, fng, movers });

        if (digest) {
            await message.reply(digest);
        } else {
            await message.reply("Market thoda chaotic hai, report generate nahi ho payi 😅");
        }

    } catch (err) {
        console.error("News handler error:", err);
        message.reply("Something went wrong 😅");
    } finally {
        stateManager.decrementRequests();
    }
}
async function handleWatchlist(message, args) {
    if (!config.CHANNELS.NEWS_COMMAND_CHANNELS.includes(message.channel.id)) return;

    const subCommand = args[0]?.toLowerCase();
    const currentList = stateManager.getWatchlist();

    if (subCommand === "add") {
        const ticker = args[1]?.toUpperCase();
        if (!ticker) return message.reply("Usage: `!watchlist add $TICKER` (always include $)");
        if (currentList.includes(ticker)) return message.reply(`${ticker} is already in the elite watchlist.`);

        currentList.push(ticker);
        stateManager.updateWatchlist(currentList);
        message.reply(`✅ Added **${ticker}** to the CONVICTION TRACKER.`);

    } else if (subCommand === "remove") {
        const ticker = args[1]?.toUpperCase();
        if (!ticker) return message.reply("Usage: `!watchlist remove $TICKER`.");

        const newList = currentList.filter(t => t !== ticker);
        if (newList.length === currentList.length) return message.reply(`${ticker} not found in watchlist.`);

        stateManager.updateWatchlist(newList);
        message.reply(`🗑️ Removed **${ticker}** from the watchlist.`);

    } else {
        // List mode
        if (currentList.length === 0) {
            message.reply("The CONVICTION TRACKER is currently empty. Add projects with `!watchlist add $TICKER`.");
        } else {
            message.reply(`👀 **NEXUS CONVICTION TRACKER**:\n${currentList.join(", ")}`);
        }
    }
}

module.exports = { handleNews, handleWatchlist };
