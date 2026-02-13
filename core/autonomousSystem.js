const heat = {};

function handleAutonomousSystem(message) {
  const guildId = message.guild?.id;
  if (!guildId) return { autonomousTrigger: false, shouldRespond: false };

  const content = message.content.toLowerCase();

  // Initialize heat if not exists
  if (!heat[guildId]) {
    heat[guildId] = 0;
  }

  // Increase heat
  heat[guildId]++;

  // Decay heat slowly
  setTimeout(() => {
    if (heat[guildId] > 0) heat[guildId]--;
  }, 15000);

  // ================= AUTONOMOUS MODE =================

  const activityLevel = heat[guildId] || 0;

  let chance = Math.random();

  if (activityLevel > 8) chance += 0.25;
  if (activityLevel > 15) chance += 0.25;

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

  // ===== PASSIVE MODE =====

  let passiveChance = 0.03;

  if (heat[guildId] > 8) passiveChance = 0.08;
  if (heat[guildId] > 15) passiveChance = 0.15;
  if (heat[guildId] > 25) passiveChance = 0.22;

  const shouldRespond = Math.random() < passiveChance;

  return { autonomousTrigger, shouldRespond };
}

module.exports = { handleAutonomousSystem };
