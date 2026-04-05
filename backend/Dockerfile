FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy source code
COPY src/ ./src/

# Expose the application port
EXPOSE 5000

# Start the application
CMD ["node", "src/server.js"]
