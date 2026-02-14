function detectIntent({ content, raidState, mentioned }) {
  content = content.toLowerCase();

  const cryptoWords = ["price","buy","sell","risk","analyze","legit","safe"];
  const greetingWords = ["hi","hello","gm","gn"];
  const faqWords = ["airdrop","tge","verification","associate role"];
  const funWords = ["roast me","i love you","hug me","kiss me"];

  if (raidState.active) return "raid";

  if (content.includes("$"))
  return "crypto";

  if (greetingWords.some(w => content === w || content.includes(w)))
    return "greeting";

  if (faqWords.some(w => content.includes(w)))
    return "faq";

  if (funWords.some(w => content.includes(w)))
    return "fun";

  if (mentioned)
    return "ai";

  return "ai";
}

module.exports = { detectIntent };
