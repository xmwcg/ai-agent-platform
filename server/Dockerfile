FROM node:20-alpine

WORKDIR /usr/src/app

# 安装 bcrypt 编译所需的构建工具
RUN apk add --no-cache python3 make g++

# 安装依赖
COPY package*.json ./
RUN npm install && apk del python3 make g++

# 复制源代码
COPY . .

# 构建 TypeScript
RUN npm run build

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["npm", "start"]
