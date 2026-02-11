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

client.on(Events.GuildMemberAdd, member => {
  const channel = member.guild.systemChannel;
  if (!channel) return;

  channel.send(
    `Ayyy ${member} welcome 😄  
Check #verification and choose associate role. No tension 👍`
  );
});

client.on(Events.MessageCreate, message => {
  if (message.author.bot) return;

  const content = message.content.toLowerCase();

  // Airdrop / TGE
  if (content.includes("airdrop") || content.includes("tge")) {
    message.reply("Airdrop/TGE? Arre chill yaar 😌 2069 confirmed. Patience rakho thoda.");
  }

  // Can't send message / Raid issue
  else if (
    content.includes("cant send") ||
    content.includes("can't send") ||
    content.includes("raid channel")
  ) {
    message.reply(
      "Bro pehle verify karlo and associate role pick karo 😄 phir easily message bhej paoge. No tension."
    );
  }

  // Legit
  else if (content.includes("is this legit")) {
    message.reply(
      "Haan bhai official server hai 😌 No fake DMs, no shady links. Safe zone."
    );
  }

  // Chad / Top G
  else if (
    content.includes("chad") ||
    content.includes("top g") ||
    content.includes("whale") ||
    content.includes("rich")
  ) {
    message.reply(
      "Chad? Top G? Whale? 😂 Obviously one and only YoungOldman bro."
    );
  }

  // Associate role channel mapping
  else if (content.includes("associate role")) {
    message.reply(
      "Associate role ka scene idhar hai bro 👉 https://discord.com/channels/1343701000174698602/1459156218793951393/1459582869470187642"
    );
  }

  // Verification channel mapping
  else if (content.includes("verification") || content.includes("verify")) {
    message.reply(
      "Verification yahan hota hai 👇 jaldi karlo 😄 👉 https://discord.com/channels/1343701000174698602/1461261524168605816/1461261526122889419"
    );
  }

  // Morning raid channel mapping
  else if (content.includes("morning raid")) {
    message.reply(
      "Morning raid idhar hota hai 🌅 sharp aa jana 👉 https://discord.com/channels/1343701000174698602/1409772569556684851"
    );
  }

  // Evening raid channel mapping
  else if (content.includes("evening raid")) {
    message.reply(
      "Evening raid ka adda yeh hai 🌆 👉 https://discord.com/channels/1343701000174698602/1442484747191320678"
    );
  }
});


client.login(process.env.TOKEN);

