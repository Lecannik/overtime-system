# Этап 1: Сборка статики
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Этап 2: Раздача статики через Nginx
FROM nginx:stable-alpine
# Копируем статические файлы из этапа сборки
COPY --from=build /app/dist /usr/share/nginx/html
# Копируем минималистичный конфиг для фронтенда (чтобы работала навигация React Router)
RUN echo 'server { listen 80; location / { root /usr/share/nginx/html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]