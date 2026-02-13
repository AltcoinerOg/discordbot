function handlePersonality({ userMessage, personality, guildId, userId }) {

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

  const p = personality[guildId][userId];

  p.lastActive = Date.now();

  if (mood === "crypto" || mood === "roast") {
    p.energy += 1;
  }

  if (mood === "supportive") {
    p.energy -= 1;
  }

  if (mood === "crypto") {
    p.degenScore += 1;
  }

  if (mood === "supportive") {
    p.emotionalScore += 1;
  }

  if (p.energy > 5) p.energy = 5;
  if (p.energy < -5) p.energy = -5;

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

  return { mood, randomStyle };
}

module.exports = { handlePersonality };
