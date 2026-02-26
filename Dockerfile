FROM node:18-alpine

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

# Start the bot
CMD ["node", "index.js"]
