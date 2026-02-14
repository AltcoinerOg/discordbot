require("dotenv").config();
const { Client, GatewayIntentBits, Events } = require("discord.js");
const cron = require("node-cron");
const fs = require("fs");
const { searchCoin, getCoinData, calculateRisk, getCryptoNews } = require("./cryptoEngine");
const { handleModeration } = require("./core/moderation");
const { handleAutonomousSystem } = require("./core/autonomousSystem");
const { handlePersonality } = require("./core/personalityEngine");
const { buildSystemPrompt } = require("./core/promptBuilder");
const { routeMessage } = require("./core/router");

// ===== RAID CONFIG =====
const MORNING_CHANNEL_ID = "1409772569556684851";
const EVENING_CHANNEL_ID = "1442484747191320678";
const ASSOCIATE_ROLE_ID = "1459120132235329536";


let raidState = {       
  active: false,
  channelId: null,
  links: 0
};


let saveTimeout = null;

function scheduleSave() {
  if (saveTimeout) return;

  saveTimeout = setTimeout(() => {
    fs.writeFile(
      "./personality.json",
      JSON.stringify(personality, null, 2),
      (err) => {
        if (err) console.error("Error saving personality:", err);
      }
    );
    saveTimeout = null;
  }, 3000);
}

let memorySaveTimeout = null;

function scheduleMemorySave() {
  if (memorySaveTimeout) return;

  memorySaveTimeout = setTimeout(() => {
    fs.writeFile(
      "./memorySummary.json",
      JSON.stringify(memorySummary, null, 2),
      (err) => {
        if (err) console.error("Error saving memory summary:", err);
      }
    );
    memorySaveTimeout = null;
  }, 3000);
}


const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});
// 🧠 Memory Store (per server)
const memory = {};
let personality = {};
let memorySummary = {};

try {
  if (fs.existsSync("./memorySummary.json")) {
    const data = fs.readFileSync("./memorySummary.json", "utf8");
    memorySummary = JSON.parse(data);
    console.log("Memory summary loaded.");
  }
} catch (err) {
  console.error("Error loading memory summary:", err);
}


try {
  if (fs.existsSync("./personality.json")) {
    const data = fs.readFileSync("./personality.json", "utf8");
    personality = JSON.parse(data);
    console.log("Personality data loaded.");
  }
} catch (err) {
  console.error("Error loading personality file:", err);
}

const heat = {};
const cooldown = {};

// ================= SUMMARY ENGINE =================

async function generateSummary(oldSummary, recentMessages) {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
        max_tokens: 120,
        messages: [
          {
            role: "system",
            content: `
You summarize Discord conversations.

Create a smart memory summary in 40-60 words.

Focus on:
- User personality
- Emotional state
- Ongoing topics
- Important preferences
- Behavior patterns

Keep it concise and intelligent.
`
          },
          {
            role: "user",
            content: `
Previous summary:
${oldSummary}

Recent conversation:
${recentMessages.map(m => `${m.role}: ${m.content}`).join("\n")}
`
          }
        ]
      })
    });

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || oldSummary;

  } catch (err) {
    console.error("Summary error:", err);
    return oldSummary;
  }
}

// ===== GLOBAL API CONTROL =====
let activeRequests = 0;
const MAX_ACTIVE_REQUESTS = 4; // safe limit
let lastAutonomousReply = 0;


client.once(Events.ClientReady, () => {
  console.log(`Bot vibing as ${client.user.tag}`);

  // ===== MORNING RAID - 11:30 AM IST =====
  cron.schedule("30 11 * * *", async () => {

    const channel = await client.channels.fetch(MORNING_CHANNEL_ID);
    if (!channel) return;

    raidState.active = true;
    raidState.channelId = MORNING_CHANNEL_ID;
    raidState.links = 0;
    raidState.startedAt = Date.now();
    raidState.reminderSent = false;


    await channel.send(
`🌅 <@&${ASSOCIATE_ROLE_ID}>

Gm associates!

The morning raid party has started.
Please share the link within 30 minutes.

Links shared after that will be removed without notice.
Refer to rules for engagement policies.`
    );

// 10-minute reminder (20 minutes after raid start)
const thisRaidStart = raidState.startedAt;

setTimeout(async () => {
  if (!raidState.active) return;
  if (raidState.reminderSent) return;
  if (raidState.startedAt !== thisRaidStart) return;

  raidState.reminderSent = true;

  await channel.send(`⏳ <@&${ASSOCIATE_ROLE_ID}>

Final 10 minutes.

Submit all valid links before closing.`);
}, 20 * 60 * 1000);


    // After 30 minutes (12:00 PM IST)
    setTimeout(async () => {

      raidState.active = false;

      const totalLinks = raidState.links;

      let hours;
      if (totalLinks >= 30) hours = 3;
      else if (totalLinks >= 20) hours = 2;
      else hours = 1;

      await channel.send(
`📊 Today we have **${totalLinks} links**.

Complete engagement within **${hours} hour(s)**.`
      );

    }, 30 * 60 * 1000);

  }, {
    timezone: "Asia/Kolkata"
  });

  // ===== EVENING RAID - 6:30 PM IST =====
  cron.schedule("30 18 * * *", async () => {

    const channel = await client.channels.fetch(EVENING_CHANNEL_ID);
    if (!channel) return;

    raidState.active = true;
    raidState.channelId = EVENING_CHANNEL_ID;
    raidState.links = 0;
    raidState.startedAt = Date.now();
    raidState.reminderSent = false;


    await channel.send(
`🌆 <@&${ASSOCIATE_ROLE_ID}>

Good evening associates!

The evening raid party has started.
Please share the link within 30 minutes.

Links shared after that will be removed without notice.
Refer to rules for engagement policies.`
    );

// 10-minute reminder (20 minutes after raid start)
const thisRaidStart = raidState.startedAt;

setTimeout(async () => {
  if (!raidState.active) return;
  if (raidState.reminderSent) return;
  if (raidState.startedAt !== thisRaidStart) return;

  raidState.reminderSent = true;

  await channel.send(`⏳ <@&${ASSOCIATE_ROLE_ID}>

Final 10 minutes.

Submit all valid links before closing.`);
}, 20 * 60 * 1000);




    // After 30 minutes (7:00 PM IST)
    setTimeout(async () => {

      raidState.active = false;

      const totalLinks = raidState.links;

      let hours;
      if (totalLinks >= 30) hours = 3;
      else if (totalLinks >= 20) hours = 2;
      else hours = 1;

      await channel.send(
`📊 Today we have **${totalLinks} links**.

Complete engagement within **${hours} hour(s)**.`
      );

    }, 30 * 60 * 1000);

  }, {
    timezone: "Asia/Kolkata"
  });

});


// ================= WELCOME SYSTEM =================
client.on(Events.GuildMemberAdd, member => {
  const channel = member.guild.systemChannel;
  if (!channel) return;

  channel.send(
    `Ayyy ${member} welcome 😄  
Check #verification and choose associate role. No tension 👍`
  );
});

// ================= MESSAGE SYSTEM =================
client.on(Events.MessageCreate, async message => {

  if (message.author.bot) return;
const intent = routeMessage({
  message,
  context: {
    content: message.content,
    raidState,
    mentioned: message.mentions.has(client.user)
  }
});

console.log("Detected Intent:", intent);


  // ===== RAID LINK TRACKING =====
  if (raidState.active && message.channel.id === raidState.channelId) {

    const linkRegex = /(https?:\/\/[^\s]+)/g;

  const matches = message.content.match(linkRegex);
  if (matches) {
  raidState.links += matches.length;
}


  }



const modResult = handleModeration(message);
if (modResult.blocked) return;

const userId = message.author.id;
const now = Date.now();


const content = message.content.toLowerCase();
const guildId = message.guild?.id;
if (!guildId) return;

const botAliases = ["bot", "Altys Slave", "bote", "slave"];

const botDiscussed = botAliases.some(alias =>
  content.includes(alias)
);

const { autonomousTrigger, shouldRespond } = handleAutonomousSystem(message);

const isReply = message.reference;
const mentionsOthers =
  message.mentions.users.some(user => user.id !== client.user.id);


const seriousKeywords = [
  "scam",
  "hack",
  "wallet drained",
  "death",
  "suicide",
  "emergency",
  "ban",
  "warning",
  "report"
];

const isSerious = seriousKeywords.some(word =>
  message.content.toLowerCase().includes(word)
);


// ================= SMART HYBRID CRYPTO ENGINE =================

if (intent === "crypto") {

// Extract coin only from $symbol format
const symbolMatch = message.content.match(/\$([a-zA-Z]{2,10})/);

if (!symbolMatch) {
  return message.reply("Use format like: price $btc");
}

const possibleCoin = symbolMatch[1].toLowerCase();



  const coinId = await searchCoin(possibleCoin);

  // ===== IF COIN EXISTS ON COINGECKO =====
  if (coinId) {

    const coinData = await getCoinData(coinId);
    if (!coinData) return message.reply("Market data fetch failed.");

    const risk = calculateRisk(coinData);
    const riskLevel = risk.level;
    const priceChange = coinData.change24h;
    const arrow = priceChange >= 0 ? "🔼" : "🔽";



    const formattedMarketCap =
      coinData.marketCap > 1_000_000_000
        ? (coinData.marketCap / 1_000_000_000).toFixed(2) + "B"
        : (coinData.marketCap / 1_000_000).toFixed(2) + "M";

    const formattedVolume =
    coinData.volume24h > 1_000_000_000
    ? (coinData.volume24h / 1_000_000_000).toFixed(2) + "B"
    : (coinData.volume24h / 1_000_000).toFixed(2) + "M";


let vibeComment = "";

if (riskLevel.toLowerCase().includes("high"))
  vibeComment = "Proper degen territory.";
else if (riskLevel.toLowerCase().includes("medium"))
  vibeComment = "Decent but don't sleep.";
else
  vibeComment = "Relatively stable vibes.";

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

// ===== FETCH CRYPTO NEWS FIRST =====
const news = await getCryptoNews(possibleCoin);

let newsContext = "";

if (news && news.length > 0) {
  newsContext = `
Recent headlines about ${possibleCoin}:
${news.join("\n")}
`;
}

// ===== IF COIN NOT FOUND → LET AI ANALYZE =====
  const aiPrompt = `
Project name: ${possibleCoin}

${newsContext}

User asked about legitimacy, farming or investment quality.

Reply in:
- Casual Indian English
- Max 3 short lines
- Hybrid pro + degen tone
- No corporate language
- No disclaimers
- Sound confident and human

Analyze:
- Hype potential
- Farming probability
- Rug risk
- Community vibes
`;

  try {

   if (activeRequests >= MAX_ACTIVE_REQUESTS) {
  return message.reply("Server thoda busy hai, 5 sec baad try karo 😅");
  }
  activeRequests++;


    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.8,
        max_tokens: 80,
        messages: [
          { role: "system", content: aiPrompt }
        ]
      })
    });

    const data = await response.json();

    if (data?.choices?.[0]?.message?.content) {
      return message.reply(data.choices[0].message.content);
    }

  } catch (err) {
    console.error(err);
  } finally {
    activeRequests--;
  }

}

 // ================= AI MODE (ONLY WHEN TAGGED) =================
if (intent === "ai") {

const guildId = message.guild.id;
const userId = message.author.id;


// ===== COOLDOWN SYSTEM =====
if (!cooldown[guildId]) cooldown[guildId] = {};

const now = Date.now();
const userCooldown = cooldown[guildId][userId] || 0;

if (now - userCooldown < 3000) {
  return message.reply("Arre thoda ruk 😅 processing chal raha hai.");
}


// update cooldown timestamp

cooldown[guildId][userId] = now;

if (!personality[guildId]) {
  personality[guildId] = {};
}

if (!personality[guildId][userId]) {
  personality[guildId][userId] = {
    vibe: "normal",
    energy: 0,
    degenScore: 0,
    emotionalScore: 0,
    title: "New Spawn",
    lastActive: Date.now()
  };
}


if (!memory[guildId]) {
  memory[guildId] = {};
}

if (!memory[guildId][userId]) {
  memory[guildId][userId] = {
    summary: memorySummary[guildId]?.[userId] || "",
    recent: []
  };
}

  const userMessage = message.content
    .replace(`<@${client.user.id}>`, "")
    .replace(`<@!${client.user.id}>`, "")
    .trim();

if (!userMessage) {
  return message.reply("Haan bolo ser 😌 kya scene hai?");
}

// Save user message into memory

if (userMessage.length > 2) {
  memory[guildId][userId].recent.push({
  role: "user",
  content: userMessage
});


}

  const { mood, randomStyle } = handlePersonality({
  userMessage,
  personality,
  guildId,
  userId
});

scheduleSave();

    try {

// ===== GLOBAL API THROTTLE =====
if (activeRequests >= MAX_ACTIVE_REQUESTS) {
  return message.reply("Server thoda busy hai 😅 try again in few seconds.");
}

activeRequests++;

      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.8,
        max_tokens: 60,

        messages: [
  {
    role: "system",
    content: buildSystemPrompt({
      mood,
      personalityData: personality[guildId][userId],
      randomStyle,
      raidActive: raidState.active
    })
  },
  ...(memory[guildId][userId].summary
    ? [{ role: "system", content: `Memory summary: ${memory[guildId][userId].summary}` }]
    : []),
  ...memory[guildId][userId].recent
]

  })
});

      const data = await response.json();
      console.log("GROQ RESPONSE:");
      console.log(JSON.stringify(data, null, 2));

      if (data?.choices?.[0]?.message?.content)
 {

      let botReply = data.choices[0].message.content;

// ===== CHAOS CONTROL FILTER =====

// Limit emojis (max 2)
botReply = botReply.replace(/([\u{1F300}-\u{1FAFF}])/gu, (match, p1, offset, string) => {
  const emojiCount = (string.match(/[\u{1F300}-\u{1FAFF}]/gu) || []).length;
  return emojiCount > 2 ? "" : match;
});

// Remove repeated exclamation spam
botReply = botReply.replace(/!{2,}/g, "!");

// Trim overly long replies just in case
if (botReply.length > 180) {
  botReply = botReply.slice(0, 180);
}


memory[guildId][userId].recent.push({
  role: "assistant",
  content: botReply
});

// ===== SMART MEMORY COMPRESSION =====
if (memory[guildId][userId].recent.length > 6) {

  const currentMemory = memory[guildId][userId];

  const newSummary = await generateSummary(
    currentMemory.summary,
    currentMemory.recent
  );

  memory[guildId][userId].summary = newSummary;

// Save only summary to file
if (!memorySummary[guildId]) {
  memorySummary[guildId] = {};
}

memorySummary[guildId][userId] = newSummary;
scheduleMemorySave();


  // Keep only last 2 exchanges (4 messages total max)
  memory[guildId][userId].recent =
    memory[guildId][userId].recent.slice(-4);
}

      return message.reply(botReply);

    } else {
      return message.reply("AI thoda confuse ho gaya 😅");
    }

  } catch (error) {
    console.error(error);
    return message.reply("AI server busy lag raha hai 😅");
   } finally {
  activeRequests--;
}


} // ← this closes AI MODE properly

if (
  shouldRespond &&
  !isReply &&
  !isSerious &&
  !raidState.active &&
  (
    botDiscussed ||
    (
      message.mentions.users.size === 0 &&
      Math.random() < 0.02
    )
  )
)
 {

  if (message.content.length < 3) return;

  const nowTime = Date.now();
  if (nowTime - lastAutonomousReply < 60000) return;
  lastAutonomousReply = nowTime;

  try {

if (activeRequests >= MAX_ACTIVE_REQUESTS - 1) return;

    activeRequests++;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.9,
        max_tokens: 50,
        messages: [
          {
            role: "system",
            content: `You are a chaotic but funny Discord AI. Reply short. Casual Indian English.`
          },
          {
            role: "user",
            content: message.content
          }
        ]
      })
    });

    const data = await response.json();

    if (data?.choices?.[0]?.message?.content) {
      await message.reply(data.choices[0].message.content);
    }

  } catch (err) {
    console.error("Autonomous reply error:", err);
  } finally {
    activeRequests--;
  }
}

});

client.login(process.env.TOKEN);

process.on("unhandledRejection", (err) => {
  console.error("Unhandled Rejection:", err);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});

