FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src ./src
COPY public ./public
RUN mkdir -p /app/data && chown -R node:node /app
USER node
ENV NODE_ENV=production PORT=3000 DB_PATH=/app/data/collabdoc.sqlite
EXPOSE 3000
CMD ["node", "src/server.js"]
