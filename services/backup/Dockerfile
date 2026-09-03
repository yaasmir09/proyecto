FROM node:20-alpine
WORKDIR /service
RUN apk add --no-cache postgresql16-client
COPY package.json ./
RUN npm install --omit=dev
COPY server.mjs ./
RUN mkdir -p /data/backups
USER node
EXPOSE 4003
CMD ["node", "server.mjs"]
