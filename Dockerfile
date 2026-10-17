FROM node:24-alpine

WORKDIR /app

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000

COPY --chown=node:node . .

USER node

EXPOSE 3000

CMD ["npm", "start"]
