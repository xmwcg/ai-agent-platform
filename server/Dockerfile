FROM node:20-alpine

WORKDIR /usr/src/app

# 使用腾讯云镜像源（同机房），加速 alpine 包与 npm 依赖安装，避免默认源在国内网络挂起
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.cloud.tencent.com/g' /etc/apk/repositories \
 && npm config set registry https://mirrors.cloud.tencent.com/npm/

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
