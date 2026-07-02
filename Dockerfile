FROM node:20-slim
WORKDIR /app
COPY . .
RUN npm run install:all && npm run build
ENV PORT=8080
EXPOSE 8080
CMD ["npm","start"]
