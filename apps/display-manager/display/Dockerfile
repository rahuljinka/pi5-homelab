# Kiosk display image: build the static page once, then serve it with nginx.
FROM node:20 AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

RUN npm run build


FROM nginx:1.27-alpine

# Filled in with DISPLAY_KEY when the container starts (nginx image feature).
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 5174
