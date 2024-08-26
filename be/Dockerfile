FROM node:16.15.0-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN apk --update add redis
RUN mkdir /data
RUN npm ci

COPY src/ src
