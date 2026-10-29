FROM node:22-alpine
WORKDIR /app
COPY package.json server.js demo.js ./
COPY public ./public
EXPOSE 3000
CMD ["npm", "start"]
