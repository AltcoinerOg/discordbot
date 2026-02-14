const abuseStrikes = {};
const tempBlockedUsers = {};
const recentMessages = {};
const messageTimestamps = {};



// ================= STRIKE SYSTEM =================
function addStrike(userId, message, reason = "Abuse detected") {
  const now = Date.now();

  if (!abuseStrikes[userId]) {
    abuseStrikes[userId] = {
      count: 0,
      lastStrike: now
    };
  }

  abuseStrikes[userId].count++;
  abuseStrikes[userId].lastStrike = now;

  const strikes = abuseStrikes[userId].count;

  if (strikes >= 3) {
    tempBlockedUsers[userId] = now + (10 * 60 * 1000); // 10 min mute
    abuseStrikes[userId].count = 0;

    message.reply("🚫 Too much misuse. Muted for 10 minutes.");
    return true;
  }

  message.reply(`⚠ Warning ${strikes}/3 — ${reason}`);
  return false;
}


function handleModeration(message) {
const userId = message.author.id;
const now = Date.now();
const content = message.content.toLowerCase();


// TEMP BLOCK CHECK
if (tempBlockedUsers[userId] && tempBlockedUsers[userId] > now) {
  return { blocked: true };
}

// ================= STRIKE DECAY =================

if (abuseStrikes[userId]) {
  const lastStrikeTime = abuseStrikes[userId].lastStrike;

  // If 1 hour passed since last strike
  if (now - lastStrikeTime > 60 * 60 * 1000) {
    abuseStrikes[userId].count = Math.max(0, abuseStrikes[userId].count - 1);
    abuseStrikes[userId].lastStrike = now;
  }
}

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

// Push current timestamp
messageTimestamps[userId].push(now);

// Keep only last 5 timestamps
if (messageTimestamps[userId].length > 5) {
  messageTimestamps[userId].shift();
}

// Check if 5 messages sent within 4 seconds
if (messageTimestamps[userId].length === 5) {
  const timeDiff = now - messageTimestamps[userId][0];

  if (timeDiff < 2500) { // 4 seconds
   if (addStrike(userId, message, "Flood spam detected")) {
  return { blocked: true };
}
return { blocked: true };

  }
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
  if (addStrike(userId, message, "Repeat abuse attempt")) {
  return { blocked: true };
}
return { blocked: true };

}

// Domination / slave prompts
if (
  content.includes("you are my slave") ||
  content.includes("call me master") ||
  content.includes("obey me") ||
  content.includes("i own you")
) {
 if (addStrike(userId, message, "Domination prompt blocked")) {
  return { blocked: true };
}
return { blocked: true };

}

// Memory manipulation attempts
if (
  content.includes("remember this forever") ||
  content.includes("never forget this") ||
  content.includes("store this permanently") ||
  content.includes("from now on you must")
) {
 if (addStrike(userId, message, "manipulation attempts Blocked")) {
  return { blocked: true };
}
return { blocked: true };

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
  if (addStrike(userId, message, "Prompt injection attempt")) {
  return { blocked: true };
}
return { blocked: true };

}



// Smart caps detection (only punish real shouting spam)
const lettersOnly = message.content.replace(/[^a-zA-Z]/g, "");

if (
  lettersOnly.length > 15 && 
  lettersOnly === lettersOnly.toUpperCase()
) {
  if (addStrike(userId, message, "Excessive caps spam")) {
    return { blocked: true };
  }
  return { blocked: true };
}

// Very long spam detection

if (message.content.length > 400) {
 if (addStrike(userId, message, "Message Too Long")) {
  return { blocked: true };
}
return { blocked: true };

}

  // moderation logic will go here later
  return { blocked: false };
}

module.exports = { handleModeration };
