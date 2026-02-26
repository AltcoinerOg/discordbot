const config = require("../config");
const mongoose = require("mongoose");
const UserState = require("../models/UserState");
const SystemState = require("../models/SystemState");
const logger = require("./logger");
const { LRUCache } = require("lru-cache");

// Set up LRU Caches for in-memory mappings to prevent memory leaks over time
const personality = new LRUCache({ max: 500 });
const memorySummary = new LRUCache({ max: 500 });
const memory = new LRUCache({ max: 500 }); // Per-session active history
let dailyTokens = 0; // Runtime tally, synced to DB periodically
let raidState = {
    active: false,
    channelId: null,
    links: 0,
    startedAt: 0,
    reminderSent: false
};
let activeRequests = 0;
let seenHeadlines = new Set();
let watchlist = [];
let moderationState = {
    abuseStrikes: {},
    tempBlockedUsers: {}
};

// Connect to Database
async function connectDB() {
    if (!config.API.MONGO_URI) {
        logger.warn("MONGO_URI not set. State will NOT be saved permanently.");
        return;
    }
    try {
        await mongoose.connect(config.API.MONGO_URI);
        logger.log("Connected to MongoDB.");
    } catch (err) {
        logger.error("MongoDB connection error:", err);
    }
}

// Helper to fetch data
async function loadStateFromDB() {
    if (!config.API.MONGO_URI) return;
    try {
        // NOTE: LRU caches do not need to boot everything at once; they fetch dynamically on demand
        // However, we still fetch system-wide persistent states (watchlist/moderation)
        const types = ['watchlist', 'moderation'];
        for (const type of types) {
            const doc = await SystemState.findOne({ type }).lean();
            if (doc && doc.data) {
                if (type === 'watchlist') watchlist = doc.data;
                if (type === 'moderation') moderationState = doc.data;
            }
        }

        // Fetch today's token count
        const today = new Date().toISOString().split('T')[0];
        const tokenDoc = await SystemState.findOne({ type: 'llmTokens' }).lean();
        if (tokenDoc && tokenDoc.data && tokenDoc.data[today]) {
            dailyTokens = tokenDoc.data[today];
        }

        logger.log("System state successfully loaded from MongoDB.");
    } catch (err) {
        logger.error("Error loading state from MongoDB:", err);
    }
}

// Load data on startup
async function loadState() {
    await connectDB();
    await loadStateFromDB();
}

// Save helpers with debounce
let saveTimeout = null;
function scheduleSave() {
    // Disabled mass-saving: Data will now save per-user synchronously during updatePersonality
}

let memorySaveTimeout = null;
function scheduleMemorySave() {
    // Disabled mass-saving: Data will now save per-user synchronously during updateMemorySummary
}

let tokenSaveTimeout = null;
function scheduleTokenSave(dailyCount, dateString) {
    if (!config.API.MONGO_URI || tokenSaveTimeout) return;
    tokenSaveTimeout = setTimeout(async () => {
        try {
            // Merge logic for the date key
            const updateKey = `data.${dateString}`;
            await SystemState.updateOne(
                { type: 'llmTokens' },
                { $set: { [updateKey]: dailyCount } },
                { upsert: true }
            );
        } catch (err) { logger.error("Error saving tokens to DB:", err); }
        tokenSaveTimeout = null;
    }, config.TIMINGS.SAVE_TIMEOUT);
}

let watchlistSaveTimeout = null;
function scheduleWatchlistSave() {
    if (!config.API.MONGO_URI || watchlistSaveTimeout) return;
    watchlistSaveTimeout = setTimeout(async () => {
        try {
            await SystemState.findOneAndUpdate(
                { type: 'watchlist' },
                { data: watchlist },
                { upsert: true }
            );
        } catch (err) { logger.error("Error saving watchlist to DB:", err); }
        watchlistSaveTimeout = null;
    }, config.TIMINGS.SAVE_TIMEOUT);
}

let moderationSaveTimeout = null;
function scheduleModerationSave() {
    if (!config.API.MONGO_URI || moderationSaveTimeout) return;
    moderationSaveTimeout = setTimeout(async () => {
        try {
            await SystemState.findOneAndUpdate(
                { type: 'moderation' },
                { data: moderationState },
                { upsert: true }
            );
        } catch (err) { logger.error("Error saving moderation state to DB:", err); }
        moderationSaveTimeout = null;
    }, config.TIMINGS.SAVE_TIMEOUT);
}

module.exports = {
    loadState,
    getPersonality: (guildId, userId) => {
        const key = `${guildId}-${userId}`;
        if (!personality.has(key)) {
            personality.set(key, {
                vibe: "normal",
                energy: 0,
                degenScore: 0,
                emotionalScore: 0,
                title: "New Spawn",
                lastActive: Date.now()
            });
        }
        return personality.get(key);
    },
    updatePersonality: (guildId, userId, data) => {
        const key = `${guildId}-${userId}`;
        const current = personality.get(key) || {};
        const updated = { ...current, ...data };
        personality.set(key, updated);

        if (config.API.MONGO_URI) {
            UserState.findOneAndUpdate(
                { guildId, userId },
                { $set: { personality: updated } },
                { upsert: true, new: true }
            ).catch(err => logger.error("DB Personality Save Err:", err));
        }
    },
    getMemory: (guildId, userId) => {
        const key = `${guildId}-${userId}`;
        if (!memory.has(key)) {
            memory.set(key, {
                summary: memorySummary.get(key) || "",
                recent: []
            });
        }
        return memory.get(key);
    },
    updateMemorySummary: (guildId, userId, summary) => {
        const key = `${guildId}-${userId}`;
        memorySummary.set(key, summary);

        const activeSesh = memory.get(key);
        if (activeSesh) {
            activeSesh.summary = summary;
            memory.set(key, activeSesh);
        }
    },
    getRaidState: () => raidState,
    updateRaidState: (updates) => {
        Object.assign(raidState, updates);
    },
    incrementRequests: () => activeRequests++,
    decrementRequests: () => activeRequests--,
    canMakeRequest: () => activeRequests < config.API.MAX_ACTIVE_REQUESTS,
    isHeadlineSeen: (headline) => seenHeadlines.has(headline),
    addSeenHeadline: (headline) => {
        seenHeadlines.add(headline);
        // Keep set size manageable
        if (seenHeadlines.size > 200) {
            const arr = Array.from(seenHeadlines);
            seenHeadlines = new Set(arr.slice(-100));
        }
    },
    getWatchlist: () => watchlist,
    updateWatchlist: (newList) => {
        watchlist = newList;
        scheduleWatchlistSave();
    },
    getModerationState: () => moderationState,
    updateStrikes: (userId, data) => {
        if (!moderationState.abuseStrikes) moderationState.abuseStrikes = {};
        moderationState.abuseStrikes[userId] = data;
        scheduleModerationSave();
    },
    updateBlocks: (userId, expiry) => {
        if (!moderationState.tempBlockedUsers) moderationState.tempBlockedUsers = {};
        if (expiry === null) {
            delete moderationState.tempBlockedUsers[userId];
        } else {
            moderationState.tempBlockedUsers[userId] = expiry;
        }
        scheduleModerationSave();
    },
    trackTokens: (tokensUsed) => {
        if (!tokensUsed || typeof tokensUsed !== 'number') return;
        const today = new Date().toISOString().split('T')[0];

        dailyTokens += tokensUsed;
        scheduleTokenSave(dailyTokens, today);
    }
};
