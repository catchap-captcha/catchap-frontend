# CatChap 프론트엔드 (React/Vite) — 빌드 후 nginx 정적 서빙
# 빌드 컨텍스트 = 이 워크트리(worktree-mobile-fe): forest-captcha 번들·모바일 반응형 포함.

# --- 1) 빌드 스테이지 ---
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

# 빌드 타임 주입 — Vite는 VITE_* 를 번들에 인라인한다(런타임 주입 불가라 build-arg로 받는다).
# VITE_API_BASE_URL 은 /api/v1 없이 base만(클라이언트가 /api/v1 을 붙인다).
ARG VITE_API_BASE_URL
ARG VITE_CATCHAP_EDU_SITE_KEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_CATCHAP_EDU_SITE_KEY=$VITE_CATCHAP_EDU_SITE_KEY
RUN npm run build

# --- 2) 서빙 스테이지 ---
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
