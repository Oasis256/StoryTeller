# ### STAGE 0: Build client ###
# FROM node:lts AS build
# WORKDIR /client
# COPY /client /client
# RUN npm install npm@8.6.0 && npm update && npm install
# RUN npm run generate

# ### STAGE 1: Build server ###
# FROM node:lts
# RUN apt update && apt install ffmpeg -y
# ENV NODE_ENV=production
# COPY --from=build /client/dist /client/dist
# COPY index.js index.js
# COPY package-lock.json package-lock.json
# COPY package.json package.json
# COPY server server
# RUN npm ci --production
# RUN apt-get clean autoclean && \
# apt-get autoremove -y && \
# rm -rf /var/lib/{apt,dpkg,cache,log}/
# EXPOSE 80
# CMD ["npm", "start"]
### STAGE 0: Build client ###
FROM node:lts AS build
WORKDIR /client
COPY /client /client
<<<<<<< HEAD
RUN npm ci && npm cache clean --force
RUN npm run generate

### STAGE 1: Build server ###
FROM sandreas/tone:v0.1.2 AS tone
FROM node:16-alpine

=======
RUN npm update && npm install
RUN npm run generate

### STAGE 1: Build server ###
FROM node:lts
RUN apk update && apk add --no-cache --update ffmpeg
>>>>>>> 013f27846d304c3da57efe8673039fc634fc2ba8
ENV NODE_ENV=production
RUN apk update && \
    apk add --no-cache --update \
    curl \
    tzdata \
    ffmpeg

COPY --from=tone /usr/local/bin/tone /usr/local/bin/
COPY --from=build /client/dist /client/dist
COPY index.js package* /
COPY server server

RUN npm ci --only=production

EXPOSE 80
<<<<<<< HEAD
HEALTHCHECK \
    --interval=30s \
    --timeout=3s \••••••
    --start-period=10s \
    CMD curl -f http://127.0.0.1/healthcheck || exit 1
CMD ["npm", "start"]
=======
CMD ["npm", "start"]
>>>>>>> 013f27846d304c3da57efe8673039fc634fc2ba8
