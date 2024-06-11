FROM node:18 as base
RUN mkdir /app
WORKDIR /app
COPY package*.json ./

FROM base as pre-prod
COPY . .
RUN npm install
RUN npm run build

FROM node:18 as prod
RUN mkdir /app
WORKDIR /app
COPY --from=pre-prod /app/.next ./.next
COPY --from=pre-prod /app/node_modules ./node_modules
COPY --from=pre-prod /app/public ./public
EXPOSE 3000
CMD ["node_modules/.bin/next", "start"]