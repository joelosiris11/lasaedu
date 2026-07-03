FROM node:20-alpine

WORKDIR /app

# Chromium + fonts for Puppeteer (puppeteer-core uses the system browser).
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p /uploads

EXPOSE 3010

CMD ["node", "index.js"]
