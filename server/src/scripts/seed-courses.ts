import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Course } from '../models/Course';

dotenv.config();

const sampleCourses = [
  {
    title: 'Linux 入门到精通',
    description: '从零基础到专业运维工程师的全栈 Linux 学习路径。涵盖命令行基础、Shell 脚本、系统管理、网络配置与安全加固。',
    instructor: 'system',
    level: 'beginner' as const,
    category: '操作系统',
    tags: ['Linux', '运维', 'Shell', '命令行'],
    price: 0,
    isPublished: true,
    enrolledStudents: 156,
    rating: 4.8,
    chapters: [
      {
        title: '第1章：Linux 基础与环境搭建',
        description: '了解 Linux 操作系统历史、安装 Ubuntu/CentOS、基本终端操作',
        order: 0,
        duration: 45,
        content: `# Linux 简介

Linux 是一套免费使用和自由传播的类 Unix 操作系统，诞生于 1991 年，由 Linus Torvalds 创建。

## 为什么学 Linux？

- 全球 90% 的服务器运行 Linux
- Android 基于 Linux 内核
- 云计算/Docker/K8s 都以 Linux 为基础
- 开发者必备技能

## 安装方式

\`\`\`bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade

# CentOS/RHEL
sudo yum update
\`\`\``,
        quiz: {
          title: 'Linux 基础测验',
          description: '检验你对 Linux 基础知识的掌握',
          passingScore: 60,
          questions: [
            { type: 'single', question: 'Linux 的创始人是谁？', options: ['Linus Torvalds', 'Bill Gates', 'Steve Jobs', 'Dennis Ritchie'], correctAnswer: 'Linus Torvalds', explanation: 'Linux Torvalds 于 1991 年创建了 Linux 内核。', points: 20 },
            { type: 'truefalse', question: 'Linux 是开源操作系统。', correctAnswer: 'true', explanation: 'Linux 遵循 GPL 许可证，完全开源。', points: 20 },
            { type: 'single', question: 'Ubuntu 中安装软件包的命令是？', options: ['sudo apt install', 'brew install', 'choco install', 'pip install'], correctAnswer: 'sudo apt install', explanation: 'apt 是 Debian/Ubuntu 系的包管理器。', points: 20 },
            { type: 'multiple', question: '以下哪些是 Linux 发行版？', options: ['Ubuntu', 'CentOS', 'Windows', 'Debian'], correctAnswer: ['Ubuntu', 'CentOS', 'Debian'], explanation: 'Windows 不属 Linux 发行版。', points: 20 },
            { type: 'fillblank', question: '查看当前目录路径的命令是 ____（英文小写）', correctAnswer: 'pwd', explanation: 'pwd = Print Working Directory', points: 20 },
          ],
        },
      },
      {
        title: '第2章：文件系统与权限管理',
        description: '理解 Linux 目录结构、文件操作、用户权限与 chmod/chown',
        order: 1,
        duration: 55,
        content: `# 文件系统

## 核心目录结构

| 目录 | 用途 |
|------|------|
| / | 根目录 |
| /home | 用户主目录 |
| /etc | 配置文件 |
| /var | 日志文件 |
| /tmp | 临时文件 |

## 文件权限

\`\`\`bash
# rwx = 读（4）+ 写（2）+ 执行（1）
chmod 755 script.sh   # rwxr-xr-x
chmod 644 config.yaml # rw-r--r--
\`\`\``,
        quiz: {
          title: '文件系统测验',
          description: '检验你对 Linux 文件系统的理解',
          passingScore: 60,
          questions: [
            { type: 'single', question: 'rwx 对应的数字权限是？', options: ['7', '6', '5', '4'], correctAnswer: '7', explanation: 'r=4, w=2, x=1, 总和=7', points: 25 },
            { type: 'single', question: '存放系统配置文件的目录是？', options: ['/etc', '/home', '/var', '/opt'], correctAnswer: '/etc', explanation: '/etc 存放系统和应用的配置文件。', points: 25 },
            { type: 'fillblank', question: '修改文件权限的命令是 ____（英文小写）', correctAnswer: 'chmod', explanation: 'chmod = change mode', points: 25 },
            { type: 'truefalse', question: 'root 用户可以绕过任何文件权限限制。', correctAnswer: 'true', explanation: 'root 拥有最高权限，不受文件权限约束。', points: 25 },
          ],
        },
      },
      {
        title: '第3章：Shell 脚本编程',
        description: '编写 Bash 脚本，自动化日常运维任务',
        order: 2,
        duration: 60,
        content: `# Shell 脚本

\`\`\`bash
#!/bin/bash
# 自动备份脚本
backup_dir="/backup/\$(date +%Y%m%d)"
mkdir -p \$backup_dir
tar -czf \$backup_dir/app.tar.gz /opt/app
echo "备份完成: \$backup_dir"
\`\`\`

## 常用控制结构

\`\`\`bash
# if 判断
if [ -f /etc/nginx/nginx.conf ]; then
  echo "配置文件存在"
fi

# for 循环
for user in \$(cut -d: -f1 /etc/passwd); do
  echo "User: \$user"
done
\`\`\``,
      },
    ],
  },
  {
    title: '云计算架构师实战',
    description: '从单机部署到云原生架构的完整进阶路径。涵盖 Docker、Kubernetes、CI/CD、微服务、可观测性等核心技术。',
    instructor: 'system',
    level: 'advanced' as const,
    category: '云计算',
    tags: ['Docker', 'Kubernetes', '云原生', 'DevOps'],
    price: 39900, // ¥399
    isPublished: true,
    enrolledStudents: 89,
    rating: 4.9,
    chapters: [
      {
        title: '第1章：容器化与 Docker 实战',
        description: 'Docker 基础、Dockerfile 编写、多阶段构建、docker-compose',
        order: 0,
        duration: 90,
        content: `# Docker 实战

## Dockerfile 最佳实践

\`\`\`dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY dist ./dist
EXPOSE 3000
CMD ["node", "dist/index.js"]
\`\`\`

## docker-compose 编排

\`\`\`yaml
version: '3.8'
services:
  app:
    build: .
    ports: ['3000:3000']
    depends_on: [mongo, redis]
  mongo:
    image: mongo:7
  redis:
    image: redis:7-alpine
\`\`\``,
        quiz: {
          title: 'Docker 测验',
          description: '检验 Docker 知识',
          passingScore: 60,
          questions: [
            { type: 'single', question: 'Dockerfile 中设置工作目录的指令是？', options: ['WORKDIR', 'CD', 'SETDIR', 'MKDIR'], correctAnswer: 'WORKDIR', points: 25 },
            { type: 'multiple', question: 'Docker 的优势包括？', options: ['环境一致性', '快速部署', '完全不需要学习成本', '资源隔离'], correctAnswer: ['环境一致性', '快速部署', '资源隔离'], points: 25 },
            { type: 'fillblank', question: 'docker-compose 的配置文件默认名称是 ____.yml', correctAnswer: 'docker-compose', points: 25 },
            { type: 'truefalse', question: 'Docker 容器与宿主机共享同一个内核。', correctAnswer: 'true', explanation: 'Docker 利用 Linux 命名空间和 cgroups，共享宿主机内核。', points: 25 },
          ],
        },
      },
      {
        title: '第2章：Kubernetes 核心概念',
        description: 'Pod、Deployment、Service、Ingress、ConfigMap/Secret',
        order: 1,
        duration: 120,
        content: `# Kubernetes 架构

## 核心组件

| 组件 | 作用 |
|------|------|
| Pod | 最小调度单元 |
| Deployment | 声明式副本管理 |
| Service | 负载均衡 |
| Ingress | 七层路由 |

## Deployment 示例

\`\`\`yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deploy
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    spec:
      containers:
      - name: nginx
        image: nginx:alpine
\`\`\``,
      },
    ],
  },
  {
    title: '大模型本地部署与微调',
    description: '手把手教你在一台或多台 GPU 服务器上部署开源大模型（LLaMA、Qwen、DeepSeek 等），并进行 LoRA 微调。',
    instructor: 'system',
    level: 'advanced' as const,
    category: 'AI/ML',
    tags: ['LLM', '微调', 'GPU', 'DeepSeek', 'vLLM'],
    price: 59900, // ¥599
    isPublished: true,
    enrolledStudents: 210,
    rating: 4.7,
    chapters: [
      {
        title: '第1章：GPU 环境准备与推理框架',
        description: 'CUDA 安装、vLLM/TGI 部署、推理加速',
        order: 0,
        duration: 75,
        content: `# GPU 推理部署

## CUDA 安装

\`\`\`bash
# 确认 GPU 可见
nvidia-smi

# 安装 CUDA Toolkit
wget https://developer.download.nvidia.com/compute/cuda/12.1.0/local_installers/cuda_12.1.0_530.30.02_linux.run
sudo sh cuda_12.1.0_530.30.02_linux.run
\`\`\`

## vLLM 部署

\`\`\`bash
pip install vllm

# 启动 DeepSeek 推理服务
python -m vllm.entrypoints.openai.api_server \\
  --model deepseek-ai/deepseek-v3 \\
  --tensor-parallel-size 8
\`\`\``,
        quiz: {
          title: 'GPU 推理测验',
          description: '检验 GPU 部署知识',
          passingScore: 60,
          questions: [
            { type: 'single', question: '检查 GPU 状态的命令是？', options: ['nvidia-smi', 'gpu-status', 'cuda-check', 'lsgpu'], correctAnswer: 'nvidia-smi', points: 25 },
            { type: 'single', question: 'vLLM 的 —tensor-parallel-size 参数用于？', options: ['多 GPU 张量并行', 'CPU 线程数', '批次大小', '内存大小'], correctAnswer: '多 GPU 张量并行', points: 25 },
            { type: 'truefalse', question: 'vLLM 支持 OpenAI 兼容的 API 接口。', correctAnswer: 'true', explanation: 'vLLM 提供与 OpenAI 兼容的 /v1/chat/completions 接口。', points: 25 },
            { type: 'fillblank', question: 'HuggingFace 上最常用的模型格式是 ____（英文大写缩写）', correctAnswer: 'GGUF', explanation: 'GGUF 是 llama.cpp 使用的量化格式，虽然还有 safetensors 等。', points: 25 },
          ],
        },
      },
      {
        title: '第2章：LoRA 微调实战',
        description: '使用 PEFT/LoRA 对大模型进行领域微调',
        order: 1,
        duration: 90,
        content: `# LoRA 微调

## 原理

LoRA (Low-Rank Adaptation) 在冻结原有权重的基础上，注入可训练的秩分解矩阵，大幅降低微调参数量。

\`\`\`python
from peft import LoraConfig, get_peft_model

lora_config = LoraConfig(
    r=8,
    lora_alpha=32,
    target_modules=["q_proj", "v_proj"],
    lora_dropout=0.1,
)

model = get_peft_model(base_model, lora_config)
\`\`\``,
      },
    ],
  },
];

async function seedCourses() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-agent-platform';
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected');

    // 清空现有课程
    await Course.deleteMany({});
    console.log('🗑️  Cleared existing courses');

    // 插入课程
    const courses = await Course.insertMany(sampleCourses);
    console.log(`✅ Inserted ${courses.length} courses:`);
    courses.forEach(c => {
      console.log(`   - ${c.title} (${c.chapters.length} chapters, ID: ${c._id})`);
    });

    await mongoose.disconnect();
    console.log('👋 Done');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
}

seedCourses();
