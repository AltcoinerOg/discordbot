FROM node:20-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY . .

# Expose the port the bot uses (default 3000 for API, Discord client runs without HTTP)
EXPOSE 3000

# Set environment variables (ensure .env is mounted in Railway)
ENV NODE_ENV=production
# Hard limit V8 garbage collection to ~400MB to prevent Railway 512MB OOM silent crashes
ENV NODE_OPTIONS="--max-old-space-size=400"

# Start the bot
CMD ["node", "index.js"]
