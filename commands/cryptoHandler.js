const { searchCoin, getCoinData, calculateRisk, getCryptoNews } = require("../cryptoEngine");
const { getCryptoAnalysis } = require("../services/aiService");
const config = require("../config");
const stateManager = require("../services/stateManager");

async function handleCrypto(message) {
    // Extract coin from $symbol
    const symbolMatch = message.content.match(/\$([a-zA-Z]{2,10})/);
    if (!symbolMatch) return message.reply("Use format like: price $btc");

    const possibleCoin = symbolMatch[1].toLowerCase();
    const coinId = await searchCoin(possibleCoin);

    // 1. COIN EXISTS
    if (coinId) {
        const coinData = await getCoinData(coinId);
        if (!coinData) return message.reply("Market data fetch failed.");

        const risk = calculateRisk(coinData);
        const riskLevel = risk.level;
        const priceChange = coinData.change24h;
        const arrow = priceChange >= 0 ? "🔼" : "🔽";

        const formattedMarketCap = coinData.marketCap > 1_000_000_000
            ? (coinData.marketCap / 1_000_000_000).toFixed(2) + "B"
            : (coinData.marketCap / 1_000_000).toFixed(2) + "M";

        const formattedVolume = coinData.volume24h > 1_000_000_000
            ? (coinData.volume24h / 1_000_000_000).toFixed(2) + "B"
            : (coinData.volume24h / 1_000_000).toFixed(2) + "M";

        let vibeComment = "";
        if (riskLevel.toLowerCase().includes("high")) vibeComment = "Proper degen territory.";
        else if (riskLevel.toLowerCase().includes("medium")) vibeComment = "Decent but don't sleep.";
        else vibeComment = "Relatively stable vibes.";

        return message.reply(
            `🔥 ${coinData.name} (${coinData.symbol.toUpperCase()})\n` +
            `💰 $${coinData.price}\n` +
            `📊 24h: ${arrow} ${priceChange}%\n` +
            `🏦 MC: $${formattedMarketCap}\n` +
            `📦 Vol: $${formattedVolume}\n` +
            `⚠ Risk: ${riskLevel}\n` +
            `${vibeComment}`
        );
    }

    // 2. COIN NOT FOUND -> AI ANALYSIS
    const news = await getCryptoNews(possibleCoin);
    let newsContext = "";
    if (news && news.length > 0) {
        newsContext = `Recent headlines about ${possibleCoin}:\n${news.join("\n")}`;
    }

    try {
        if (!stateManager.canMakeRequest()) {
            return message.reply("Server thoda busy hai, 5 sec baad try karo 😅");
        }
        stateManager.incrementRequests();

        const content = await getCryptoAnalysis(possibleCoin, newsContext);

        if (content) {
            return message.reply(content);
        } else {
            return message.reply("AI thoda confuse ho gaya 😅");
        }

    } catch (err) {
        console.error(err);
        message.reply("Something went wrong 😅");
    } finally {
        stateManager.decrementRequests();
    }
}

module.exports = { handleCrypto };
