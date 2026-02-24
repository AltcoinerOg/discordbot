const Parser = require("rss-parser");
const parser = new Parser({
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8'
  }
});

// ===== NEWS CACHE SYSTEM =====
const newsCache = {};
const NEWS_CACHE_DURATION = 60000; // 60 seconds

// ===== FETCH WITH TIMEOUT =====
function fetchWithTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error("Request timed out")), ms)
  );

  return Promise.race([promise, timeout]);
}

// ===== GLOBAL NEWS RATE LIMIT =====
let newsRequestsThisMinute = 0;

setInterval(() => {
  newsRequestsThisMinute = 0;
}, 60000); // reset every 60 seconds


// ===== SEARCH COIN BY NAME =====
async function searchCoin(query) {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`
    );

    const data = await response.json();

    if (!data.coins || data.coins.length === 0) {
      return null; // no coin found
    }

    return data.coins[0].id;

  } catch (error) {
    console.error("Error searching coin:", error);
    return null;
  }
}


// ===== GET FULL COIN DATA =====
async function getCoinData(coinId) {
  try {
    const response = await fetch(
      `https://api.coingecko.com/api/v3/coins/${coinId}`
    );

    const data = await response.json();
    return {
      name: data.name,
      symbol: data.symbol,
      price: data.market_data.current_price.usd || 0,
      marketCap: data.market_data.market_cap.usd || 0,
      volume24h: data.market_data?.total_volume?.usd || 0,
      rank: data.market_cap_rank || "N/A",
      change24h: data.market_data.price_change_percentage_24h || 0,
      website: data.links.homepage[0] || "N/A",
      description: data.description.en
        ? data.description.en.substring(0, 300) + "..."
        : "No description available."
    };

  } catch (error) {
    console.error("Error fetching coin data:", error);
    return null;
  }
}

// ===== CALCULATE RISK SCORE =====
function calculateRisk(data) {
  let score = 0;

  // Market Cap Risk
  if (data.marketCap > 1000000000) {
    score += 1; // Large cap (lower risk)
  } else if (data.marketCap > 100000000) {
    score += 2;
  } else if (data.marketCap > 10000000) {
    score += 3;
  } else {
    score += 4; // Small cap (higher risk)
  }

  // Volume Risk
  if (data.volume24h < 1000000) {
    score += 2;
  } else if (data.volume24h < 10000000) {
    score += 1;
  }

  // Rank Risk
  if (data.rank > 500) {
    score += 2;
  } else if (data.rank > 100) {
    score += 1;
  }

  let level = "Low Risk";

  if (score >= 6) {
    level = "High Risk";
  } else if (score >= 4) {
    level = "Medium Risk";
  }

  return {
    score,
    level
  };
}

// ===== GET CRYPTO NEWS FROM MULTIPLE SOURCES =====
async function getCryptoNews(query) {

  // ===== CHECK CACHE FIRST =====
  if (newsCache[query]) {
    const { data, timestamp } = newsCache[query];

    if (Date.now() - timestamp < NEWS_CACHE_DURATION) {
      return data;
    }
  }

  // ===== GLOBAL RATE LIMIT CHECK =====
  if (newsRequestsThisMinute >= 10) {
    return null; // too many requests this minute
  }

  newsRequestsThisMinute++;


  try {
    const feeds = [
      "https://www.coindesk.com/arc/outboundfeeds/rss/",
      "https://cointelegraph.com/rss",
      "https://decrypt.co/feed"
    ];

    let allHeadlines = [];

    for (const feed of feeds) {
      try {
        const parsed = await fetchWithTimeout(
          parser.parseURL(feed),
          5000 // 5 second timeout
        );


        const filtered = parsed.items
          .filter(item =>
            item.title &&
            item.title.toLowerCase().includes(query.toLowerCase())
          )
          .slice(0, 3)
          .map(item => item.title);

        allHeadlines.push(...filtered);

      } catch (err) {
        console.error("Feed error:", feed);
      }
    }

    if (allHeadlines.length === 0) {
      return null;
    }

    const finalHeadlines = allHeadlines.slice(0, 5);

    // Save to cache
    newsCache[query] = {
      data: finalHeadlines,
      timestamp: Date.now()
    };

    return finalHeadlines;


  } catch (error) {
    console.error("News fetch error:", error);
    return null;
  }
}



// ===== GET TRENDING NEWS (GLOBAL) =====
async function getTrendingNews() {
  try {
    const feeds = [
      "https://www.coindesk.com/arc/outboundfeeds/rss/",
      "https://cointelegraph.com/rss",
      "https://decrypt.co/feed",
      "https://cryptoslate.com/feed/",
      "https://www.newsbtc.com/feed/",
      "https://ambcrypto.com/feed/" // Reliable alternative
    ];

    let allHeadlines = [];
    for (const feed of feeds) {
      try {
        const parsed = await fetchWithTimeout(parser.parseURL(feed), 12000);
        allHeadlines.push(...parsed.items.map(item => item.title));
      } catch (err) {
        console.error("Feed error:", feed);
      }
    }
    return allHeadlines.slice(0, 20); // Return top 20 latest headlines
  } catch (error) {
    console.error("News fetch error:", error);
    return [];
  }
}

// ===== GET TRENDING COINS (COINGECKO) =====
async function getTrendingCoins() {
  try {
    const response = await fetch("https://api.coingecko.com/api/v3/search/trending");
    const data = await response.json();
    return data.coins.map(c => `${c.item.name} (${c.item.symbol})`).slice(0, 5);
  } catch (error) {
    console.error("Trending coins error:", error);
    return [];
  }
}

// ===== GET TRENDING SOLANA COINS =====
async function getTrendingSolanaCoins() {
  try {
    // We use the Coingecko public search/trending and filter for SOL if possible, 
    // or just fetch general trending and label them.
    const response = await fetch("https://api.coingecko.com/api/v3/search/trending");
    const data = await response.json();
    return data.coins
      .filter(c => c.item.network_id === "solana" || c.item.symbol.toLowerCase().includes("sol"))
      .map(c => `${c.item.name} (${c.item.symbol})`)
      .slice(0, 3);
  } catch (error) {
    console.error("Solana trending error:", error);
    return [];
  }
}

// ===== GET FEAR & GREED INDEX =====
async function getFearGreedIndex() {
  try {
    const response = await fetch("https://api.alternative.me/fng/");
    const data = await response.json();
    return {
      value: data.data[0].value,
      label: data.data[0].value_classification
    };
  } catch (error) {
    console.error("Fear & Greed error:", error);
    return { value: "N/A", label: "N/A" };
  }
}

// ===== GET TOP MOVERS (GAINERS/LOSERS) =====
async function getTopMovers() {
  try {
    // We use markets endpoint with order to get gainers/losers
    const response = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false&price_change_percentage=24h");
    const data = await response.json();

    const sortedByChange = [...data].sort((a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h);

    const gainers = sortedByChange.slice(0, 3).map(c => `${c.symbol.toUpperCase()} (+${c.price_change_percentage_24h.toFixed(1)}%)`);
    const losers = sortedByChange.slice(-3).reverse().map(c => `${c.symbol.toUpperCase()} (${c.price_change_percentage_24h.toFixed(1)}%)`);

    return { gainers, losers };
  } catch (error) {
    console.error("Top movers error:", error);
    return { gainers: [], losers: [] };
  }
}

// ===== EXPORT FUNCTIONS =====
module.exports = {
  searchCoin,
  getCoinData,
  calculateRisk,
  getTrendingNews,
  getTrendingCoins,
  getTrendingSolanaCoins,
  getFearGreedIndex,
  getTopMovers
};
