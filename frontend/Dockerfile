# Stage 1: Build the React application
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies required for Vite build)
RUN npm ci

# Copy the source code (.env is ignored via .dockerignore, but you can explicitly pass args if needed)
COPY . .

# Build the Vite application for production
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Copy the custom Nginx configuration for Client-Side Routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built assets from the previous stage
COPY --from=build /app/dist /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
