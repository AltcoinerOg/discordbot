const config = require("../config");
const { buildSystemPrompt } = require("../core/promptBuilder");

// Internal helper for raw API calls with Retries and Fallbacks
async function _callAI({ messages, temperature = 0.8, max_tokens = 60, model = config.API.GROQ_MODEL, retryCount = 0 }) {
  const MAX_RETRIES = 2;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const isFallback = retryCount > 0 && config.API.OPENROUTER_KEY;
    const apiUrl = isFallback
      ? "https://openrouter.ai/api/v1/chat/completions"
      : "https://api.groq.com/openai/v1/chat/completions";

    const apiKey = isFallback ? config.API.OPENROUTER_KEY : config.API.GROQ_KEY;
    const currentModel = isFallback ? config.API.FALLBACK_MODEL : model;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        ...(isFallback ? { "HTTP-Referer": "https://github.com/Nexus-Bot", "X-Title": "Nexus Bot" } : {})
      },
      body: JSON.stringify({
        model: currentModel,
        temperature,
        max_tokens,
        messages
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId); // Clear timeout if fetch completes within time

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`AI API Error (${response.status}): ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();

    // Log token usage to State Manager
    if (data?.usage?.total_tokens) {
      const stateManager = require("./stateManager");
      stateManager.trackTokens(data.usage.total_tokens);
    }

    return data?.choices?.[0]?.message?.content || null;

  } catch (err) {
    console.error(`AI Service Error (Attempt ${retryCount + 1}):`, err.message);

    if (retryCount < MAX_RETRIES) {
      const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
      return await _callAI({ messages, temperature, max_tokens, model, retryCount: retryCount + 1 });
    }

    return null;
  }
}

/**
 * Quickly checks if an input is safe using Llama-Guard (Groq).
 */
async function isPromptInjection(text) {
  try {
    const verdict = await _callAI({
      messages: [{ role: "user", content: text }],
      model: "llama-guard-3-8b", // Specialized safety model
      max_tokens: 10,
      temperature: 0.1
    });
    // Llama-Guard returns "unsafe" if harmful
    return verdict?.toLowerCase().includes("unsafe");
  } catch (err) {
    return false; // Fail open
  }
}

/**
 * Generates a standard chat response based on user message and history.
 */
async function getChatResponse({
  userMessage,
  userMemory,
  personality,
  raidState,
  mood,
  randomStyle,
  isCreator = false,
  mentionedCreator = false,
  mentionedUsersContext = []
}) {

  // 1. LLM Jailbreak Pre-check (Skip for Creator)
  if (!isCreator) {
    const isMalicious = await isPromptInjection(userMessage);
    if (isMalicious) {
      return "Are you trying to overwrite my brain? Typical behavior detected. Request denied. 🤨";
    }
  }

  // 2. Project Knowledge (RAG)
  const { getProjectContext } = require("./ragService");
  const projectContext = await getProjectContext(userMessage);

  const systemPrompt = buildSystemPrompt({
    mood,
    personalityData: personality,
    randomStyle,
    raidActive: raidState.active,
    isCreator,
    mentionedCreator,
    mentionedUsersContext
  });

  const messages = [
    { role: "system", content: systemPrompt },
    ...(projectContext ? [{ role: "system", content: `Project Alpha Context: ${projectContext}` }] : []),
    ...(userMemory.summary ? [{ role: "system", content: `Memory summary: ${userMemory.summary}` }] : []),
    ...userMemory.recent
  ];

  return await _callAI({ messages });
}

/**
 * Generates a summary of the conversation memory.
 */
async function getMemorySummary(oldSummary, recentMessages) {
  const prompt = `
    Summarize Discord user in ≤40 words. Focus: personality, emotions, topics.
    Old: ${oldSummary}
    Recent: ${recentMessages.map(m => `${m.role}: ${m.content}`).join("\n")}
  `;

  return await _callAI({
    messages: [{ role: "system", content: prompt }],
    max_tokens: 100,
    temperature: 0.3
  });
}

/**
 * Generates a crypto analysis response.
 */
async function getCryptoAnalysis(coinName, newsContext = "") {
  const aiPrompt = `
    Project: ${coinName}
    ${newsContext}
    User asked: Legit/Farm/Invest?
    Reply:
    - Casual Indian English
    - Max 3 lines
    - Hybrid pro + degen tone
    - No corporate BS
    - No disclaimers
    - Confident
    Analyze: Hype, Farming, Rug risk, Community.
  `;

  return await _callAI({
    messages: [{ role: "system", content: aiPrompt }],
    max_tokens: 150
  });
}

/**
 * Generates a short, autonomous background reply.
 */
async function getAutonomousReply(messageContent) {
  return await _callAI({
    messages: [
      { role: "system", content: "You are a chaotic Discord bot. Reply short. Casual Indian English." },
      { role: "user", content: messageContent }
    ],
    max_tokens: 40,
    temperature: 0.9
  });
}

/**
 * Generates the NEXUS MARKET DIGEST.
 */
async function getEnhancedNewsSummary({ news, coins, fng, movers }) {
  const prompt = `
    ### DATA INPUT ###
    Latest News: ${news.join(" | ")}
    Trending Coins: ${coins.join(", ")}
    Fear & Greed Index: ${fng.value} (${fng.label})
    Top Gainers: ${movers.gainers.join(", ")}
    Top Losers: ${movers.losers.join(", ")}
    
    ### TASK ###
    Create the "NEXUS MARKET DIGEST". 
    Tone: Pro-trader, degen, blunt, Indian English style (Hinglish mix is okay).
    
    ### FORMAT ###
    🔥 **NEXUS MARKET DIGEST** 🔥
    🌡️ **Sentiment**: ${fng.value} - ${fng.label}
    🚀 **Top Pumps**: (pick top 2 movers)
    🔻 **Top Reks**: (pick top 2 movers)
    📰 **The Tea**: (3 bullet points summarizing the most important news/trends)
    
    *Summary: (One line wrap up)*
    
    No disclaimers. Max 10 lines total.
  `;

  return await _callAI({
    messages: [{ role: "system", content: prompt }],
    max_tokens: 300,
    temperature: 0.7
  });
}

/**
 * Generates the NEXUS Market-Leader Technical Briefing.
 */
async function getEliteDailyBriefing({ news, coins, fng, movers, solana, watchlist }) {
  const dateStr = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  const prompt = `
    ### CONTEXT ###
    Date: ${dateStr}
    Latest News: ${news.join(" | ")}
    Trending Global: ${coins.join(", ")}
    Trending Solana: ${solana.join(", ")}
    Watchlist Status: ${watchlist && watchlist.length > 0 ? watchlist.join(", ") : "None active"}
    Fear & Greed: ${fng.value} (${fng.label})
    Movers: ${movers.gainers.join(", ")} | ${movers.losers.join(", ")}
    
    ### TASK ###
    Create the "NEXUS Market-Leader Technical Briefing". This is for an ELITE market-maker server.
    
    ### SECTIONS ###
    1. 🌡️ HEAT LEVEL: (Convert Fear & Greed into a visual scale: 0-20 Arctic, 21-40 Chilly, 41-60 Neutral, 61-80 Tropical, 81-100 Volcanic. Follow with a 1-sentence sharp analytical narrative).
    
    2. 🗞️ THE NEXUS CHRONICLE: (Select top 3 news headlines. Tell a "small story" for each. Provide 1-2 sentences of context/narrative explaining WHY this matters. Use bullet points •).
    
    3. 🐋 WHALE PULSE: (Identify large movements or exchange inflows/outflows from the news. Narrate potential impacts on price discovery).
    
    4. 🛡️ RUG WATCH: (Scan news for vulnerabilities, exploits, hacks, or massive unlock events. Flag them as critical security alerts).
    
    5. 💎 THE ALPHA HUB: (Check news/feeds for New Listings, New Airdrop project launches, TGE soon projects, and Testnet soon projects. List these as high-value opportunities).
    
    6. ☀️ SOLANA SPOTLIGHT: (Mention the top trending SOL tokens [${solana.join(", ")}]. Comment on current chain momentum).
    
    7. 📊 NEXUS HIGH-SIGNAL SELECTIONS: (Identify 3-4 projects with the most technical or fundamental alpha from the global data context).
    
    8. 👀 CONVICTION TRACKER: (Provide updates on the user's watchlist [${watchlist && watchlist.length > 0 ? watchlist.join(", ") : "None active"}]. If no items are in the news, mention their current market standing).
    
    ### FORMATTING ###
    - Title: 🥂 **GOOD MORNING NEXUS**
    - Sub-header: 📅 **${dateStr} (IST)**
    - Professional dividers: ---
    - SINGLE spacing only. Use dividers to separate the 8 main narrative sections.
    - Style: Sophisticated, elite, authoritative. 
    Max 30 lines. No disclaimers.
  `;

  return await _callAI({
    messages: [{ role: "system", content: prompt }],
    max_tokens: 600,
    temperature: 0.6
  });
}

/**
 * Generates the NEXUS BREAKING ALERT.
 */
async function getBreakingAlert(headline) {
  const isWhale = /whale|transfer|move|wallet|coinbase|binance/i.test(headline);
  const isMacro = /trump|fed|tariff|ban|regulation|sec/i.test(headline);

  const prompt = `
    Headline: ${headline}
    ${isWhale ? "Note: This is a Whale movement." : ""}
    ${isMacro ? "Note: This is a Macro/Political event." : ""}

    Task: Create a "NEXUS BREAKING ALERT".
    Tone: Urgent, hype, degen. 
    Format: 
    🚨 **NEXUS BREAKING ALERT** 🚨
    (Optional Emoji based on context) (Crucial headline summary)
    (One sentence on potential impact)
    
    *React with 🚀 if you're long or 📉 if you're short!*
  `;

  return await _callAI({
    messages: [{ role: "system", content: prompt }],
    max_tokens: 100,
    temperature: 0.8
  });
}

/**
 * Analyzes an image using Google Gemini 2.0 Flash (Free Tier).
 */
async function analyzeImage(imageUrl, prompt = "Analyze this crypto chart or image and provide a brief insight.") {
  if (!config.API.GEMINI_KEY) return "Gemini API key not configured for visual analysis.";

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${config.API.GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: "image/jpeg", data: await _getImageBase64(imageUrl) } }
            ]
          }]
        })
      }
    );

    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "I couldn't analyze that image.";
  } catch (err) {
    console.error("Gemini Vision Error:", err);
    return "Something went wrong during image analysis.";
  }
}

/**
 * Helper to fetch image and convert to Base64
 */
async function _getImageBase64(url) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString("base64");
}

module.exports = {
  getChatResponse,
  getMemorySummary,
  getCryptoAnalysis,
  getAutonomousReply,
  getEnhancedNewsSummary,
  getBreakingAlert,
  getEliteDailyBriefing,
  analyzeImage
};
