require("dotenv").config();
const { Client, GatewayIntentBits, Events } = require("discord.js");
const cron = require("node-cron");
const fs = require("fs");
const { searchCoin, getCoinData, calculateRisk, getCryptoNews } = require("./cryptoEngine");
const { handleModeration } = require("./core/moderation");
const { handleAutonomousSystem } = require("./core/autonomousSystem");
const { handlePersonality } = require("./core/personalityEngine");
const { buildSystemPrompt } = require("./core/promptBuilder");

// ===== RAID CONFIG =====
const MORNING_CHANNEL_ID = "1409772569556684851";
const EVENING_CHANNEL_ID = "1442484747191320678";
const ASSOCIATE_ROLE_ID = "1470973703574655039";


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


// ===== GLOBAL API CONTROL =====
let activeRequests = 0;
const MAX_ACTIVE_REQUESTS = 3; // safe limit

client.once(Events.ClientReady, () => {
  console.log(`Bot vibing as ${client.user.tag}`);

  // ===== MORNING RAID - 11:30 AM IST =====
  cron.schedule("30 11 * * *", async () => {

    const channel = await client.channels.fetch(MORNING_CHANNEL_ID);
    if (!channel) return;

    raidState.active = true;
    raidState.channelId = MORNING_CHANNEL_ID;
    raidState.links = 0;

    await channel.send(
`🌅 <@&${ASSOCIATE_ROLE_ID}>

Gm associates!

The morning raid party has started.
Please share the link within 30 minutes.

Links shared after that will be removed without notice.
Refer to rules for engagement policies.`
    );

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

    await channel.send(
`🌆 <@&${ASSOCIATE_ROLE_ID}>

Good evening associates!

The evening raid party has started.
Please share the link within 30 minutes.

Links shared after that will be removed without notice.
Refer to rules for engagement policies.`
    );

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

  // ===== RAID LINK TRACKING =====
  if (raidState.active && message.channel.id === raidState.channelId) {

    const linkRegex = /(https?:\/\/[^\s]+)/g;

    if (linkRegex.test(message.content)) {
      raidState.links++;
    }

  }



const modResult = handleModeration(message);
if (modResult.blocked) return;

const userId = message.author.id;
const now = Date.now();


const content = message.content.toLowerCase();
const guildId = message.guild?.id;
if (!guildId) return;

const { autonomousTrigger, shouldRespond } = handleAutonomousSystem(message);

// ================= SMART HYBRID CRYPTO ENGINE =================

const cryptoKeywords = [
  "price",
  "analyze",
  "risk",
  "legit",
  "farm",
  "safe",
  "buy",
  "sell"
];

const isCryptoQuery = cryptoKeywords.some(keyword =>
  content.includes(keyword)
);

if (isCryptoQuery) {

const stopWords = [
  // trigger words
  "price",
  "analyze",
  "risk",
  "safe",
  "legit",
  "farm",
  "buy",
  "sell",

  // common fillers
  "is",
  "are",
  "was",
  "were",
  "should",
  "can",
  "could",
  "would",
  "do",
  "does",
  "did",
  "i",
  "me",
  "my",
  "you",
  "it",
  "this",
  "that",
  "of",
  "the",
  "a",
  "an",

  // question fillers
  "what",
  "about",
  "how",
  "when",
  "where",
  "why",

  // time words
  "today",
  "now",
  "tomorrow",

  // generic crypto words
  "coin",
  "token",
  "project"
];


const words = content
  .split(" ")
  .filter(word => !stopWords.includes(word));

const possibleCoin = words.find(word => word.length >= 2);

if (!possibleCoin) {
  message.reply("Please specify a coin name. Example: price btc");
  return;
}


  const coinId = await searchCoin(possibleCoin);

  // ===== IF COIN EXISTS ON COINGECKO =====
  if (coinId) {

    const coinData = await getCoinData(coinId);
    if (!coinData) return message.reply("Market data fetch failed.");

    const risk = calculateRisk(coinData);
    const riskLevel = risk.level;


    const formattedMarketCap =
      coinData.marketCap > 1_000_000_000
        ? (coinData.marketCap / 1_000_000_000).toFixed(2) + "B"
        : (coinData.marketCap / 1_000_000).toFixed(2) + "M";

let vibeComment = "";

if (riskLevel.toLowerCase().includes("high"))
  vibeComment = "Proper degen territory.";
else if (riskLevel.toLowerCase().includes("medium"))
  vibeComment = "Decent but don’t sleep.";
else
  vibeComment = "Relatively stable vibes.";

    return message.reply(
      `🔥 ${coinData.name}\n` +
      `💰 $${coinData.price}\n` +
      `📊 24h: ${coinData.change24h}%\n` +
      `🏦 MC: $${formattedMarketCap}\n` +
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

    if (activeRequests >= MAX_ACTIVE_REQUESTS) return;
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
if (message.mentions.has(client.user) || shouldRespond || autonomousTrigger) {

const guildId = message.guild.id;
const userId = message.author.id;


// ===== COOLDOWN SYSTEM =====
if (!cooldown[guildId]) cooldown[guildId] = {};

const now = Date.now();
const userCooldown = cooldown[guildId][userId] || 0;

// 7 second cooldown per user
if (now - userCooldown < 7000) return;

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
  memory[guildId][userId] = [];
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
  memory[guildId][userId].push({
    role: "user",
    content: userMessage
  });

if (memory[guildId][userId].length > 6) {
  memory[guildId][userId].shift();
}
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
  return; // silently ignore if overloaded
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
          randomStyle
        })
      },
      ...memory[guildId][userId]
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


     memory[guildId][userId].push({
  role: "assistant",
  content: botReply
});

if (memory[guildId][userId].length > 6) {
  memory[guildId][userId].shift();
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


  // ================= FAQ / SERVER HELP =================
  if (content.includes("airdrop") || content.includes("tge"))
    return message.reply("Airdrop/TGE? Arre chill yaar 😌 2069 confirmed.");

  if (content.includes("cant send") || content.includes("can't send") || content.includes("raid channel"))
    return message.reply("Bro pehle verify karlo and associate role pick karo 😄");

  if (content.includes("is this legit"))
    return message.reply("Haan bhai official server hai 😌 No fake DMs.");

  if (content.includes("chad") || content.includes("top g") || content.includes("whale") || content.includes("rich"))
    return message.reply("Chad? Top G? Whale? 😂 Obviously YoungOldman bro.");

  if (content.includes("associate role"))
    return message.reply("Associate role 👉 https://discord.com/channels/1343701000174698602/1459156218793951393/1459582869470187642");

  if (content.includes("verification") || content.includes("verify"))
    return message.reply("Verification 👉 https://discord.com/channels/1343701000174698602/1461261524168605816/1461261526122889419");

  if (content.includes("morning raid"))
    return message.reply("Morning raid 🌅 👉 https://discord.com/channels/1343701000174698602/1409772569556684851");

  if (content.includes("evening raid"))
    return message.reply("Evening raid 🌆 👉 https://discord.com/channels/1343701000174698602/1442484747191320678");

  // ================= BASIC GREETINGS =================
  if (content === "hi" || content === "hello")
    return message.reply("Yo 👋 I was sleeping but ok.");

  if (content.includes("how are you"))
    return message.reply("Mentally unstable but operational 🤖");

  if (content.includes("who are you"))
    return message.reply("I am the server's unpaid employee.");

  if (content.includes("rate me"))
    return message.reply(`${Math.floor(Math.random() * 10) + 1}/10 😏`);

  if (content.includes("good morning") || content === "gm")
    return message.reply("GM legend ☀️ Charts check kiya ya sirf vibes?");

  if (content.includes("good night") || content === "gn")
    return message.reply("GN degen 🌙 Portfolio pump ho sapne me.");

  // ================= ROAST MODE =================
  if (content.includes("roast me")) {
    const roasts = [
      "You type like autocorrect gave up.",
      "Main character delusion detected.",
      "You clap when plane lands.",
      "Limited edition human."
    ];
    return message.reply(roasts[Math.floor(Math.random() * roasts.length)]);
  }

  // ================= FLIRTY MODE =================
  if (content.includes("i love you"))
    return message.reply("I love you too… slow down tiger 😌");

  if (content.includes("kiss me"))
    return message.reply("💋 Virtual kiss delivered.");

  if (content.includes("hug me"))
    return message.reply("🤗 Aa ja yaar.");

  if (content.includes("rizz"))
    return message.reply("I don't chase. I ping.");

  if (content.includes("good bot"))
    return message.reply("Validation received 😌");

  // ================= CRYPTO MODE =================
  if (content.includes("btc"))
    return message.reply("BTC mentioned 👀 Everyone act normal.");

  if (content.includes("eth"))
    return message.reply("ETH gas fees entered chat.");

  if (content.includes("wen moon") || content.includes("when moon"))
    return message.reply("Soon™️. Trust vibes.");

  if (content.includes("bull run"))
    return message.reply("Bull run loading... 3%");

  if (content.includes("bear market"))
    return message.reply("Bear market builds legends 🐻");

  if (content.includes("dip"))
    return message.reply("Every dip tasty lagta hai until you buy.");

  if (content.includes("rug"))
    return message.reply("Liquidity check karo pehle.");

  if (content.includes("wagmi"))
    return message.reply("WAGMI if survive long enough.");

  if (content.includes("ngmi"))
    return message.reply("Skill issue detected.");

  if (content.includes("fomo"))
    return message.reply("FOMO temporary. Pain permanent.");

  if (content.includes("diamond hands"))
    return message.reply("Diamond hands until rent due.");

  if (content.includes("paper hands"))
    return message.reply("Paper hands spotted 🚨");

  if (content.includes("buy now"))
    return message.reply("Not financial advice™️");

  if (content.includes("sell now"))
    return message.reply("Sell = pump. Hold = dump.");

  // ================= ETH CHAOS =================
  if (content.includes("gas"))
    return message.reply("Gas fees higher than expectations.");

  if (content.includes("layer 2") || content.includes("l2"))
    return message.reply("L2 = cheaper mistakes.");

  if (content.includes("arb"))
    return message.reply("Arbitrum gang assembling.");

  if (content.includes("metamask"))
    return message.reply("Metamask popup = heart attack.");

  if (content.includes("wallet drained"))
    return message.reply("One click and generational wealth gone.");

  // ================= GM CULTURE =================
  if (content.includes("gm farmers"))
    return message.reply("GM farmers 🌾 Grind hard.");

  if (content.includes("ser"))
    return message.reply("Yes ser?");

  if (content.includes("based"))
    return message.reply("Based and decentralized.");

  if (content.includes("devs asleep"))
    return message.reply("Devs asleep. Ship memes.");

  if (content.includes("market red"))
    return message.reply("Red candles build character.");

  if (content.includes("market green"))
    return message.reply("Green candles activate ego.");

});

client.login(process.env.TOKEN);
