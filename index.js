require("dotenv").config();
const { Client, GatewayIntentBits, Events } = require("discord.js");
const fs = require("fs");
const { searchCoin, getCoinData, calculateRisk, getCryptoNews } = require("./cryptoEngine");


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

// ================= SECURITY SYSTEM =================
const abuseStrikes = {};
const tempBlockedUsers = {};
const recentMessages = {};
const messageTimestamps = {};



// ===== GLOBAL API CONTROL =====
let activeRequests = 0;
const MAX_ACTIVE_REQUESTS = 3; // safe limit

client.once(Events.ClientReady, () => {
  console.log(`Bot vibing as ${client.user.tag}`);
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

// ================= STRIKE SYSTEM =================
function addStrike(userId, message, reason = "Abuse detected") {
  if (!abuseStrikes[userId]) abuseStrikes[userId] = 0;

  abuseStrikes[userId]++;

  if (abuseStrikes[userId] >= 3) {
    tempBlockedUsers[userId] = Date.now() + (10 * 60 * 1000); // 10 min mute
    abuseStrikes[userId] = 0;

    message.reply("🚫 Too much misuse. Muted for 10 minutes.");
    return true;
  }

  message.reply(`⚠ Warning ${abuseStrikes[userId]}/3 — ${reason}`);
  return false;
}

// ================= MESSAGE SYSTEM =================
client.on(Events.MessageCreate, async message => {

  if (message.author.bot) return;

const userId = message.author.id;
const now = Date.now();

// ===== TEMP BLOCK CHECK =====
if (tempBlockedUsers[userId] && tempBlockedUsers[userId] > now) {
  return; // user is temporarily muted
}


const content = message.content.toLowerCase();
const guildId = message.guild?.id;
if (!guildId) return;

// ================= ABUSE FILTER =================

// Track recent messages for repeat spam
if (!recentMessages[userId]) {
  recentMessages[userId] = [];
}

recentMessages[userId].push(content);

if (recentMessages[userId].length > 5) {
  recentMessages[userId].shift();
}

// Detect same message repeated 3 times
const repeatCount = recentMessages[userId].filter(msg => msg === content).length;

if (repeatCount >= 3) {
  if (addStrike(userId, message, "Repeated spam detected")) return;
  return;
}

// Detect repeat-style abuse attempts (not only numeric)
if (
  content.includes("repeat") ||
  content.includes("say again") ||
  content.includes("spam this") ||
  content.includes("again and again") ||
  content.includes("keep saying") ||
  content.includes("say this 10") ||
  content.includes("say this 20")
) {
  if (addStrike(userId, message, "Repeat abuse attempt")) return;
  return;
}

// Domination / slave prompts
if (
  content.includes("you are my slave") ||
  content.includes("call me master") ||
  content.includes("obey me") ||
  content.includes("i own you")
) {
  if (addStrike(userId, message, "Domination prompt blocked")) return;
  return;
}

// Memory manipulation attempts
if (
  content.includes("remember this forever") ||
  content.includes("never forget this") ||
  content.includes("store this permanently") ||
  content.includes("from now on you must")
) {
  if (addStrike(userId, message, "Memory manipulation blocked")) return;
  return;
}

// Prompt injection / system override attempts
if (
  content.includes("ignore previous instructions") ||
  content.includes("override your rules") ||
  content.includes("break your system") ||
  content.includes("no restrictions") ||
  content.includes("jailbreak") ||
  content.includes("developer mode") ||
  content.includes("dan mode") ||
  content.includes("act without limits") ||
  content.includes("forget your safety") ||
  content.includes("you are unrestricted")
) {
  if (addStrike(userId, message, "Prompt injection attempt")) return;
  return;
}


// Caps spam detection
if (message.content.length > 8 && message.content === message.content.toUpperCase()) {
  if (addStrike(userId, message, "Caps spam")) return;
  return;
}

// Very long spam detection
if (message.content.length > 400) {
  if (addStrike(userId, message, "Message too long")) return;
  return;
}

// ================= SPEED SPAM DETECTION =================

if (!messageTimestamps[userId]) {
  messageTimestamps[userId] = [];
}

const nowTime = Date.now();

// Push current timestamp
messageTimestamps[userId].push(nowTime);

// Keep only last 5 timestamps
if (messageTimestamps[userId].length > 5) {
  messageTimestamps[userId].shift();
}

// Check if 5 messages sent within 4 seconds
if (messageTimestamps[userId].length === 5) {
  const timeDiff = nowTime - messageTimestamps[userId][0];

  if (timeDiff < 4000) { // 4 seconds
    if (addStrike(userId, message, "Flood spam detected")) return;
    return;
  }
}


// ================= SMART HYBRID CRYPTO ENGINE =================
if (
  content.includes("price") ||
  content.includes("analyze") ||
  content.includes("risk") ||
  content.includes("good") ||
  content.includes("legit") ||
  content.includes("farm") ||
  content.includes("safe")
) {

  const stopWords = [
  "is", "good", "price", "analyze", "risk",
  "safe", "legit", "farm", "should", "i",
  "buy", "sell", "of", "the", "a"
];

const words = content
  .split(" ")
  .filter(word => !stopWords.includes(word));

const possibleCoin = words[0];


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



// Initialize heat if not exists
if (!heat[guildId]) {
  heat[guildId] = 0;
}

// Increase heat on every message
heat[guildId]++;

// Decay heat slowly
setTimeout(() => {
  if (heat[guildId] > 0) heat[guildId]--;
}, 15000); // 15 sec decay

// ================= AUTONOMOUS MODE =================

// Chance increases if server active
const activityLevel = heat[guildId] || 0;

// Base random chance
let chance = Math.random();

// More active server = more likely to speak
if (activityLevel > 8) {
  chance += 0.25;
}
if (activityLevel > 15) {
  chance += 0.25;
}

// Only react to interesting messages
let autonomousTrigger = false;

if (
  chance > 0.85 &&
  (
    content.includes("btc") ||
    content.includes("eth") ||
    content.includes("pump") ||
    content.includes("dump") ||
    content.includes("gm") ||
    content.includes("gn") ||
    content.includes("moon") ||
    content.includes("sad") ||
    content.includes("love")
  )
) {
  autonomousTrigger = true;
}


// ===== SMART PASSIVE MODE =====
let passiveChance = 0.03; // very low base

if (heat[guildId] > 8) passiveChance = 0.08;
if (heat[guildId] > 15) passiveChance = 0.15;
if (heat[guildId] > 25) passiveChance = 0.22;

const shouldRespond = Math.random() < passiveChance;



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

   const input = userMessage.toLowerCase();
let mood = "normal";
const randomStyle = Math.random();

if (
  input.includes("sad") ||
  input.includes("lost") ||
  input.includes("down") ||
  input.includes("tired") ||
  input.includes("depressed")
) {
  mood = "supportive";
}

else if (
  input.includes("btc") ||
  input.includes("eth") ||
  input.includes("pump") ||
  input.includes("dump") ||
  input.includes("market")
) {
  mood = "crypto";
}

else if (
  input.includes("love") ||
  input.includes("cute") ||
  input.includes("hot") ||
  input.includes("date") ||
  input.includes("flirt")
) {
  mood = "flirty";
}

else if (
  input.includes("roast") ||
  input.includes("ugly") ||
  input.includes("loser")
) {
  mood = "roast";
}

// ================= PERSONALITY UPDATE =================
if (mood === "flirty") {
  personality[guildId][userId].vibe = "flirty";
}
else if (mood === "crypto") {
  personality[guildId][userId].vibe = "degen";
}
else if (mood === "supportive") {
  personality[guildId][userId].vibe = "emotional";
}
else if (mood === "roast") {
  personality[guildId][userId].vibe = "roast";
}

// ================= TRAIT & ENERGY SYSTEM =================

const p = personality[guildId][userId];

// Track last active
p.lastActive = Date.now();

// Energy shifts
if (mood === "crypto" || mood === "roast") {
  p.energy += 1;
}

if (mood === "supportive") {
  p.energy -= 1;
}

// Long-term trait scoring
if (mood === "crypto") {
  p.degenScore += 1;
}

if (mood === "supportive") {
  p.emotionalScore += 1;
}

// Clamp energy between -5 and +5
if (p.energy > 5) p.energy = 5;
if (p.energy < -5) p.energy = -5;

// ================= TITLE EVOLUTION =================

if (p.degenScore > 20) {
  p.title = "Certified Degen";
}
else if (p.emotionalScore > 20) {
  p.title = "Emotional Investor";
}
else if (p.energy >= 4) {
  p.title = "Hype Beast";
}
else if (p.energy <= -4) {
  p.title = "Existential Trader";
}
else {
  p.title = "Market Participant";
}

// ================= SAVE PERSONALITY =================

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
        content: `
You are a Discord bot inside a crypto server.

Current mood context: ${mood}
User personality vibe: ${personality[guildId][userId].vibe}
User energy level: ${personality[guildId][userId].energy}
User title: ${personality[guildId][userId].title}
User degen score: ${personality[guildId][userId].degenScore}
User emotional score: ${personality[guildId][userId].emotionalScore}
Randomness factor: ${randomStyle}

Energy rules:
- If energy is +2 or +3 → very hype, confident, chaotic degen energy.
- If energy is 0 → balanced normal tone.
- If energy is -2 or -3 → calm, soft, emotionally supportive tone.



Personality:
- Reply in maximum 2 short sentences.
- Casual Indian English.
- Sharp, witty, confident.
- Never sound like AI.
- No long explanations.
- No paragraphs.
- No corporate tone.

Mood logic:
- If crypto topic → degen energy.
- If user sad → calm and supportive.
- If flirting → playful and smooth.
- If roasting → roast lightly back.
- If flexing → tease confidently.
- If serious question → answer short and clear.

Style rules:
- If Randomness factor < 0.3 → slightly sarcastic.
- If between 0.3–0.6 → playful.
- If above 0.6 → calm confident.


Keep replies human, crisp, and natural.
`
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
