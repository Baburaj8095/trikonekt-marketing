# Stage 1: Build React Application
FROM node:18-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source code and build
COPY . .
RUN npm run build

# Stage 2: Serve Build Files via Nginx
FROM nginx:alpine

# Copy built static assets from Stage 1
COPY --from=builder /app/build /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
