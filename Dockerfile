### STAGE 0: Build client ###
FROM node:lts AS build
WORKDIR /client
COPY /client /client
RUN npm install npm@8.6.0 && npm update && npm install
RUN npm run generate

### STAGE 1: Build server ###
FROM node:lts
RUN apt update && apt install ffmpeg -y
ENV NODE_ENV=production
COPY --from=build /client/dist /client/dist
COPY index.js index.js
COPY package-lock.json package-lock.json
COPY package.json package.json
COPY server server
RUN npm ci --production
RUN apt-get clean autoclean && \
apt-get autoremove -y && \
rm -rf /var/lib/{apt,dpkg,cache,log}/
EXPOSE 80
CMD ["npm", "start"]
