# 构建阶段：用 Node 安装依赖并产出静态文件
FROM node:18-alpine AS build
WORKDIR /app
ARG NPM_REGISTRY=https://registry.npmmirror.com
COPY package*.json ./
RUN npm install --registry "${NPM_REGISTRY}" \
      --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-timeout=120000
COPY . .
RUN npm run build

# 运行阶段：nginx 托管 dist，并把 /api 反代到 api 容器
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 18080 18443
# https.conf 与 nginx.conf 由 deploy/start.sh 以 :ro 挂载，改配置后 nginx -s reload 即可
CMD ["nginx", "-g", "daemon off;"]
