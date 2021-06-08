FROM node:current-alpine3.13 AS BUILD_IMAGE

WORKDIR /app

COPY package.json ./
COPY yarn.lock ./
RUN yarn install

COPY . .

RUN yarn run build

FROM node:current-alpine3.13

ENV NODE_ENV=production

WORKDIR /app

COPY package.json ./
COPY yarn.lock ./
RUN yarn install

COPY --from=BUILD_IMAGE /app/dist ./dist

RUN rm -r package.json yarn.lock dist/test

CMD [ "node", "dist/src/index.js" ]
