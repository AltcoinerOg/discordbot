const { Client, GatewayIntentBits, Events } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once(Events.ClientReady, () => {
  console.log(`Bot vibing as ${client.user.tag}`);
});

// ===== WELCOME SYSTEM =====
client.on(Events.GuildMemberAdd, member => {
  const channel = member.guild.systemChannel;
  if (!channel) return;

  channel.send(
    `Ayyy ${member} welcome 😄  
Check #verification and choose associate role. No tension 👍`
  );
});

// ===== MESSAGE SYSTEM =====
client.on(Events.MessageCreate, message => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  // ===== FAQ / SERVER HELP =====
  if (content.includes("airdrop") || content.includes("tge"))
    return message.reply("Airdrop/TGE? Arre chill yaar 😌 2069 confirmed. Patience rakho thoda.");

  if (content.includes("cant send") || content.includes("can't send") || content.includes("raid channel"))
    return message.reply("Bro pehle verify karlo and associate role pick karo 😄 phir easily message bhej paoge.");

  if (content.includes("is this legit"))
    return message.reply("Haan bhai official server hai 😌 No fake DMs, no shady links.");

  if (content.includes("chad") || content.includes("top g") || content.includes("whale") || content.includes("rich"))
    return message.reply("Chad? Top G? Whale? 😂 Obviously one and only YoungOldman bro.");

  if (content.includes("associate role"))
    return message.reply("Associate role idhar hai 👉 https://discord.com/channels/1343701000174698602/1459156218793951393/1459582869470187642");

  if (content.includes("verification") || content.includes("verify"))
    return message.reply("Verification yahan hota hai 👇 👉 https://discord.com/channels/1343701000174698602/1461261524168605816/1461261526122889419");

  if (content.includes("morning raid"))
    return message.reply("Morning raid idhar hota hai 🌅 👉 https://discord.com/channels/1343701000174698602/1409772569556684851");

  if (content.includes("evening raid"))
    return message.reply("Evening raid ka adda yeh hai 🌆 👉 https://discord.com/channels/1343701000174698602/1442484747191320678");

  // ===== BASIC GREETINGS =====
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

  // ===== ROAST MODE =====
  if (content.includes("roast me")) {
    const roasts = [
      "You type like autocorrect gave up.",
      "You look like you clap when plane lands.",
      "Main character delusion detected.",
      "You're not useless… just limited edition."
    ];
    return message.reply(roasts[Math.floor(Math.random() * roasts.length)]);
  }

  // ===== FLIRTY MODE =====
  if (content.includes("i love you"))
    return message.reply("I love you too… but slow down tiger 😌");

  if (content.includes("kiss me"))
    return message.reply("💋 Virtual kiss delivered.");

  if (content.includes("hug me"))
    return message.reply("🤗 Aa ja yaar.");

  if (content.includes("rizz"))
    return message.reply("I don't chase. I ping.");

  if (content.includes("good bot"))
    return message.reply("Validation received 😌");

  // ===== CRYPTO MODE =====
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

  // ===== ETH / L2 CHAOS =====
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

  // ===== GM CULTURE =====
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
