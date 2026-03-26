FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_API_BASE_URL=http://localhost:8000
ARG VITE_API_BASE_URL_NATIVE=http://localhost:8000

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_API_BASE_URL_NATIVE=$VITE_API_BASE_URL_NATIVE

# Esto ayuda a detectar cambios en Docker (hot reload si usas dev)
ENV CHOKIDAR_USEPOLLING=true
ENV CHOKIDAR_INTERVAL=100

# En producción sigue haciendo build
RUN npm run build

# =========================
# Etapa de producción (nginx)
# =========================
FROM nginx:1.27-alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
