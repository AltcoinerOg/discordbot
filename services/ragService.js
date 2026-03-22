const { Pinecone } = require("@pinecone-database/pinecone");
const config = require("../config");
const logger = require("./logger");

let index = null;

if (config.API.PINECONE.KEY && config.API.PINECONE.INDEX) {
    const pc = new Pinecone({ apiKey: config.API.PINECONE.KEY });
    index = pc.index(config.API.PINECONE.INDEX);
    logger.log("Pinecone Index Initialized for RAG.");
}

/**
 * Searches the project knowledge base for relevant context.
 * @param {string} query - The user's question or search term.
 * @returns {Promise<string>} - Relevant context snippets joined as a string.
 */
async function getProjectContext(query) {
    if (!index) return "";

    try {
        // NOTE: In a production environment, you would use an embedding model
        // (like OpenAI or HuggingFace) to convert the query into a vector first.
        // For this free-tier implementation, we assume the index is populated.
        // If no embedding model is configured, this is a placeholder for the logic.

        // logger.log(`Searching Pinecone for: ${query}`);

        // Placeholder for actual vector search logic
        // const results = await index.query({ ... });
        // return results.matches.map(m => m.metadata.text).join("\n");

        return ""; // Return empty if search is not possible without embeddings
    } catch (err) {
        logger.error("Pinecone Search Error:", err);
        return "";
    }
}

module.exports = { getProjectContext };
