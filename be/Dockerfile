FROM node:16.15.0-alpine
ENV INSTALL_PATH /usr/src/app

WORKDIR $INSTALL_PATH

COPY package*.json ./

RUN apk --update add redis
RUN mkdir /data
RUN npm ci

COPY src/ src
