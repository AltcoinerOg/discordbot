const mongoose = require('mongoose');

const SystemStateSchema = new mongoose.Schema({
    type: { type: String, required: true, unique: true }, // 'watchlist' or 'moderation'
    data: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

const SystemState = mongoose.model('SystemState', SystemStateSchema);

module.exports = SystemState;
