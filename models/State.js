const mongoose = require('mongoose');

// We will use a single document for each state type to mimic the old JSON files.
// This is simple and effective for this scale.
const StateSchema = new mongoose.Schema({
    // 'personality', 'memorySummary', 'watchlist', 'moderation'
    type: { type: String, required: true, unique: true },

    // Flexible data payload to hold the JSON structures
    data: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

const State = mongoose.model('State', StateSchema);

module.exports = State;
