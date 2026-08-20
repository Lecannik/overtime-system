# Этап 1: Сборка статики
FROM node:20-alpine as build
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Этап 2: Раздача статики через Nginx
FROM nginx:stable-alpine
# Копируем статические файлы из этапа сборки
COPY --from=build /app/dist /usr/share/nginx/html
# Копируем оптимизированный конфиг Nginx для SPA (no-cache для index.html, 404 для missing assets)
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]