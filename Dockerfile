FROM node:22-bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm install --omit=dev=false
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV ATCC_DISPLAY_MODE=paper
ENV ATCC_LIVE_ENABLED=false
ENV ATCC_AUTONOMOUS_ENABLED=false
EXPOSE 3000
CMD ["npm", "start"]
