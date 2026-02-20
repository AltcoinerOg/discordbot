require("dotenv").config();

module.exports = {
    // Discord IDs
    CHANNELS: {
        MORNING_RAID: "1409772569556684851",
        EVENING_RAID: "1442484747191320678"
    },
    ROLES: {
        ASSOCIATE: "1459120132235329536"
    },

    // API Configuration
    API: {
        GROQ_KEY: process.env.GROQ_API_KEY,
        DISCORD_TOKEN: process.env.TOKEN,
        MAX_ACTIVE_REQUESTS: 4,
        GROQ_MODEL: "llama-3.3-70b-versatile",
        API_PORT: process.env.API_PORT || 3000,
        API_SECRET: process.env.API_SECRET || "changeme"
    },

    // Timings (in milliseconds)
    TIMINGS: {
        SAVE_TIMEOUT: 3000,
        MORNING_RAID_DURATION: 31 * 60 * 1000, // 31 minutes
        MORNING_RAID_REMINDER: 21 * 60 * 1000, // 21 minutes (10 mins left)
        EVENING_RAID_DURATION: 61 * 60 * 1000, // 61 minutes
        EVENING_RAID_REMINDER: 51 * 60 * 1000, // 51 minutes (10 mins left)
        NEWS_CACHE_DURATION: 60000, // 60 seconds
        AUTONOMOUS_COOLDOWN: 60000, // 1 minute
        USER_COOLDOWN: 3000 // 3 seconds
    }
};
