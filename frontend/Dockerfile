# Этап 1: Сборка статики
FROM node:20-alpine as build
WORKDIR /app
# Аргумент для быстрой сборки (пропуск проверки типов)
ARG FAST_BUILD=false

# Установка зависимостей с кешированием
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm install

COPY . .

# Сборка: если FAST_BUILD=true, запускаем только vite build без tsc
RUN if [ "$FAST_BUILD" = "true" ]; then \
    npm run build-only; \
    else \
    npm run build; \
    fi

# Этап 2: Раздача статики через Nginx
FROM nginx:stable-alpine
# Копируем статические файлы из этапа сборки
COPY --from=build /app/dist /usr/share/nginx/html
# Копируем минималистичный конфиг для фронтенда (чтобы работала навигация React Router)
RUN echo 'server { listen 80; location / { root /usr/share/nginx/html; try_files $uri $uri/ /index.html; } }' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]