# 生产阶段：用 Nginx 托管预构建的静态资源（dist 在宿主机已构建）
FROM nginx:alpine
COPY dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
