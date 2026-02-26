const config = require("../config");
const mongoose = require("mongoose");
const State = require("../models/State");
const logger = require("./logger");

// In-memory state (caches data from DB for fast synchronous reads)
let personality = {};
let memorySummary = {};
let memory = {}; // Per-session memory
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
    try {
        const types = ['personality', 'memorySummary', 'watchlist', 'moderation'];
        for (const type of types) {
            const doc = await State.findOne({ type }).lean();
            if (doc && doc.data) {
                if (type === 'personality') personality = doc.data;
                if (type === 'memorySummary') memorySummary = doc.data;
                if (type === 'watchlist') watchlist = doc.data;
                if (type === 'moderation') moderationState = doc.data;
            }
        }
        logger.log("State successfully loaded from MongoDB.");
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
    if (saveTimeout) return;
    saveTimeout = setTimeout(async () => {
        try {
            await State.findOneAndUpdate(
                { type: 'personality' },
                { data: personality },
                { upsert: true }
            );
        } catch (err) { logger.error("Error saving personality to DB:", err); }
        saveTimeout = null;
    }, config.TIMINGS.SAVE_TIMEOUT);
}

let memorySaveTimeout = null;
function scheduleMemorySave() {
    if (memorySaveTimeout) return;
    memorySaveTimeout = setTimeout(async () => {
        try {
            await State.findOneAndUpdate(
                { type: 'memorySummary' },
                { data: memorySummary },
                { upsert: true }
            );
        } catch (err) { logger.error("Error saving memory summary to DB:", err); }
        memorySaveTimeout = null;
    }, config.TIMINGS.SAVE_TIMEOUT);
}

let watchlistSaveTimeout = null;
function scheduleWatchlistSave() {
    if (watchlistSaveTimeout) return;
    watchlistSaveTimeout = setTimeout(async () => {
        try {
            await State.findOneAndUpdate(
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
    if (moderationSaveTimeout) return;
    moderationSaveTimeout = setTimeout(async () => {
        try {
            await State.findOneAndUpdate(
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
        if (!personality[guildId]) personality[guildId] = {};
        if (!personality[guildId][userId]) {
            personality[guildId][userId] = {
                vibe: "normal",
                energy: 0,
                degenScore: 0,
                emotionalScore: 0,
                title: "New Spawn",
                lastActive: Date.now()
            };
        }
        return personality[guildId][userId];
    },
    updatePersonality: (guildId, userId, data) => {
        if (!personality[guildId]) personality[guildId] = {};
        personality[guildId][userId] = { ...personality[guildId][userId], ...data };
        scheduleSave();
    },
    getMemory: (guildId, userId) => {
        if (!memory[guildId]) memory[guildId] = {};
        if (!memory[guildId][userId]) {
            memory[guildId][userId] = {
                summary: memorySummary[guildId]?.[userId] || "",
                recent: []
            };
        }
        return memory[guildId][userId];
    },
    updateMemorySummary: (guildId, userId, summary) => {
        if (!memorySummary[guildId]) memorySummary[guildId] = {};
        memorySummary[guildId][userId] = summary;
        scheduleMemorySave();

        // Update active memory session too if needed
        if (memory[guildId]?.[userId]) {
            memory[guildId][userId].summary = summary;
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
    }
};
