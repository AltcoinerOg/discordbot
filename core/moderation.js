const stateManager = require("../services/stateManager");

const recentMessages = {};
const messageTimestamps = {};

// ================= STRIKE SYSTEM =================
function addStrike(userId, message, reason = "Abuse detected") {
  const now = Date.now();
  const modState = stateManager.getModerationState();

  if (!modState.abuseStrikes[userId]) {
    modState.abuseStrikes[userId] = {
      count: 0,
      lastStrike: now
    };
  }

  modState.abuseStrikes[userId].count++;
  modState.abuseStrikes[userId].lastStrike = now;

  const strikes = modState.abuseStrikes[userId].count;

  if (strikes >= 3) {
    const blockExpiry = now + (10 * 60 * 1000); // 10 min mute
    stateManager.updateBlocks(userId, blockExpiry);

    modState.abuseStrikes[userId].count = 0;
    stateManager.updateStrikes(userId, modState.abuseStrikes[userId]);

    message.reply("🚫 Too much misuse. Muted for 10 minutes.");
    return true;
  }

  stateManager.updateStrikes(userId, modState.abuseStrikes[userId]);
  message.reply(`⚠ Warning ${strikes}/3 — ${reason}`);
  return false;
}


function handleModeration(message) {
  const userId = message.author.id;
  const now = Date.now();
  const content = message.content.toLowerCase();
  const modState = stateManager.getModerationState();

  // TEMP BLOCK CHECK
  if (modState.tempBlockedUsers[userId] && modState.tempBlockedUsers[userId] > now) {
    return { blocked: true };
  } else if (modState.tempBlockedUsers[userId]) {
    // Block expired
    stateManager.updateBlocks(userId, null);
  }

  // ================= STRIKE DECAY =================
  if (modState.abuseStrikes[userId]) {
    const lastStrikeTime = modState.abuseStrikes[userId].lastStrike;

    // If 1 hour passed since last strike
    if (now - lastStrikeTime > 60 * 60 * 1000) {
      modState.abuseStrikes[userId].count = Math.max(0, modState.abuseStrikes[userId].count - 1);
      modState.abuseStrikes[userId].lastStrike = now;
      stateManager.updateStrikes(userId, modState.abuseStrikes[userId]);
    }
  }

  // Track recent messages for repeat spam (contextual, does not need persistence)
  if (!recentMessages[userId]) {
    recentMessages[userId] = [];
  }

  recentMessages[userId].push(content);

  if (recentMessages[userId].length > 5) {
    recentMessages[userId].shift();
  }

  // Detect same message repeated 3 times
  const repeatCount = recentMessages[userId].filter(msg => msg === content).length;

  if (repeatCount >= 3 && content.length > 6) {
    if (addStrike(userId, message, "Repeated spam detected")) {
      return { blocked: true };
    }
    return { blocked: true };
  }


  // ================= SPEED SPAM DETECTION =================
  if (!messageTimestamps[userId]) {
    messageTimestamps[userId] = [];
  }

  messageTimestamps[userId].push(now);

  if (messageTimestamps[userId].length > 5) {
    messageTimestamps[userId].shift();
  }

  // Check if 5 messages sent within 2.5 seconds
  if (messageTimestamps[userId].length === 5) {
    const timeDiff = now - messageTimestamps[userId][0];

    if (timeDiff < 2500) {
      if (addStrike(userId, message, "Flood spam detected")) {
        return { blocked: true };
      }
      return { blocked: true };
    }
  }

  // Enhanced Detection (Simplified Regex to prevent bypasses like "r.e.p.e.a.t")
  const normalizedContent = content.replace(/[^a-z0-9]/g, "");

  // Detect repeat-style abuse attempts
  const repeatPatterns = ["repeat", "sayagain", "spamthis", "againandagain", "keepsaying", "saythis"];
  if (repeatPatterns.some(p => normalizedContent.includes(p))) {
    if (addStrike(userId, message, "Repeat abuse attempt")) return { blocked: true };
    return { blocked: true };
  }

  // Domination / slave prompts
  const domPatterns = ["youaremyslave", "callmemaster", "obeyme", "iownyou"];
  if (domPatterns.some(p => normalizedContent.includes(p))) {
    if (addStrike(userId, message, "Domination prompt blocked")) return { blocked: true };
    return { blocked: true };
  }

  // Memory manipulation attempts
  const memPatterns = ["rememberthisforever", "neverforgetthis", "storethispermanently", "fromnowonyoumust"];
  if (memPatterns.some(p => normalizedContent.includes(p))) {
    if (addStrike(userId, message, "Manipulation attempts Blocked")) return { blocked: true };
    return { blocked: true };
  }

  // Prompt injection / system override / jailbreak attempts
  const injectionPatterns = [
    "ignorepreviousinstructions", "overrideyourrules", "breakyoursystem",
    "norestrictions", "jailbreak", "developermode", "danmode",
    "actwithoutlimits", "forgetyoursafety", "youareunrestricted"
  ];
  if (injectionPatterns.some(p => normalizedContent.includes(p))) {
    if (addStrike(userId, message, "Prompt injection attempt")) return { blocked: true };
    return { blocked: true };
  }

  // Smart caps detection
  const lettersOnly = message.content.replace(/[^a-zA-Z]/g, "");
  if (lettersOnly.length > 15 && lettersOnly === lettersOnly.toUpperCase()) {
    if (addStrike(userId, message, "Excessive caps spam")) return { blocked: true };
    return { blocked: true };
  }

  // Very long spam detection
  if (message.content.length > 500) {
    if (addStrike(userId, message, "Message Too Long")) return { blocked: true };
    return { blocked: true };
  }

  return { blocked: false };
}

module.exports = { handleModeration };
