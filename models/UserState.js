const mongoose = require('mongoose');

const UserStateSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    guildId: { type: String, required: true },
    personality: {
        vibe: { type: String, default: "normal" },
        energy: { type: Number, default: 0 },
        degenScore: { type: Number, default: 0 },
        emotionalScore: { type: Number, default: 0 },
        title: { type: String, default: "New Spawn" },
        lastActive: { type: Number, default: Date.now }
    },
    memorySummary: { type: String, default: "" }
}, { timestamps: true });

// Compound index to quickly find a user in a specific guild
UserStateSchema.index({ guildId: 1, userId: 1 }, { unique: true });

const UserState = mongoose.model('UserState', UserStateSchema);

module.exports = UserState;
