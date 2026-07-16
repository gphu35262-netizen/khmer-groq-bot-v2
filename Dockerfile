FROM node:20-slim

# Dependencies needed by sharp and @imgly/background-removal-node
RUN apt-get update && apt-get install -y \
    python3 make g++ curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (layer cache)
COPY package.json ./
RUN npm install --production

# Copy bot source
COPY index.js bot.js ./
COPY bot/ ./bot/

ENV NODE_ENV=production

CMD ["node", "index.js"]
