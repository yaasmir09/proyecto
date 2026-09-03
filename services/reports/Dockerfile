FROM node:20-alpine
WORKDIR /service
COPY package.json ./
RUN npm install --omit=dev
COPY server.mjs ./
USER node
EXPOSE 4002
CMD ["node", "server.mjs"]
