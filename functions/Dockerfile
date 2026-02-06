FROM node:20-alpine

WORKDIR /app

COPY functions/package*.json ./

RUN npm install --production

COPY functions/ .

EXPOSE 3000

CMD ["npm", "start"]
