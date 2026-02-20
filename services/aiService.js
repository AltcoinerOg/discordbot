const config = require("../config");
const { buildSystemPrompt } = require("../core/promptBuilder");

// Internal helper for raw API calls
async function _callAI({ messages, temperature = 0.8, max_tokens = 60, model = config.API.GROQ_MODEL }) {
  try {
    const response = await fetch(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.API.GROQ_KEY}`
        },
        body: JSON.stringify({
          model,
          temperature,
          max_tokens,
          messages
        })
      }
    );

    const data = await response.json();
    return data?.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error("AI Service Error:", err);
    return null;
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
  randomStyle
}) {
  const systemPrompt = buildSystemPrompt({
    mood,
    personalityData: personality,
    randomStyle,
    raidActive: raidState.active
  });

  const messages = [
    { role: "system", content: systemPrompt },
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

module.exports = {
  getChatResponse,
  getMemorySummary,
  getCryptoAnalysis,
  getAutonomousReply
};
