const fs = require("fs");
const path = require("path");
const config = require("../config");

// File paths
const PERSONALITY_FILE = path.join(__dirname, "../personality.json");
const MEMORY_FILE = path.join(__dirname, "../memorySummary.json");
const WATCHLIST_FILE = path.join(__dirname, "../watchlist.json");
const MODERATION_FILE = path.join(__dirname, "../moderationState.json");

// In-memory state
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

// Load data on startup
function loadState() {
    try {
        if (fs.existsSync(PERSONALITY_FILE)) {
            personality = JSON.parse(fs.readFileSync(PERSONALITY_FILE, "utf8"));
            console.log("Personality data loaded.");
        }
        if (fs.existsSync(MEMORY_FILE)) {
            memorySummary = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
            console.log("Memory summary loaded.");
        }
        if (fs.existsSync(WATCHLIST_FILE)) {
            watchlist = JSON.parse(fs.readFileSync(WATCHLIST_FILE, "utf8"));
            console.log("Watchlist data loaded.");
        }
        if (fs.existsSync(MODERATION_FILE)) {
            moderationState = JSON.parse(fs.readFileSync(MODERATION_FILE, "utf8"));
            console.log("Moderation state loaded.");
        }
    } catch (err) {
        console.error("Error loading state files:", err);
    }
}

// Save helpers with debounce
let saveTimeout = null;
function scheduleSave() {
    if (saveTimeout) return;
    saveTimeout = setTimeout(() => {
        fs.writeFile(PERSONALITY_FILE, JSON.stringify(personality, null, 2), (err) => {
            if (err) console.error("Error saving personality:", err);
        });
        saveTimeout = null;
    }, config.TIMINGS.SAVE_TIMEOUT);
}

let memorySaveTimeout = null;
function scheduleMemorySave() {
    if (memorySaveTimeout) return;
    memorySaveTimeout = setTimeout(() => {
        fs.writeFile(MEMORY_FILE, JSON.stringify(memorySummary, null, 2), (err) => {
            if (err) console.error("Error saving memory summary:", err);
        });
        memorySaveTimeout = null;
    }, config.TIMINGS.SAVE_TIMEOUT);
}

let watchlistSaveTimeout = null;
function scheduleWatchlistSave() {
    if (watchlistSaveTimeout) return;
    watchlistSaveTimeout = setTimeout(() => {
        fs.writeFile(WATCHLIST_FILE, JSON.stringify(watchlist, null, 2), (err) => {
            if (err) console.error("Error saving watchlist:", err);
        });
        watchlistSaveTimeout = null;
    }, config.TIMINGS.SAVE_TIMEOUT);
}

let moderationSaveTimeout = null;
function scheduleModerationSave() {
    if (moderationSaveTimeout) return;
    moderationSaveTimeout = setTimeout(() => {
        fs.writeFile(MODERATION_FILE, JSON.stringify(moderationState, null, 2), (err) => {
            if (err) console.error("Error saving moderation state:", err);
        });
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
