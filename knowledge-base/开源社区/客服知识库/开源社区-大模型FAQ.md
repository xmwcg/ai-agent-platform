---
title: 开源社区 · 大模型应用知识库（FAQ 模板）
industry: 开源社区
category: 客服知识库
vendor: ''
tags: [开源, 社区, faq, 模型, 部署, 许可]
sourceUrl: https://www.skillhub.cn/enterprise-zone
fetchedAt: 2026-07-21
requiredPlan: free
creditsCost: 0
freePreviewPages: 0
---

# 开源社区 · 大模型应用知识库

## 常见问答（示例）
1. **Q：有哪些值得关注的开源大模型？**
   A：Qwen 系列、GLM-4 开源版、Yi、DeepSeek 开源权重、Llama、Mistral、Gemma 等（以官方仓库为准）。

2. **Q：怎么本地部署？**
   A：用 Ollama / vLLM / llama.cpp 拉取权重，暴露 OpenAI 兼容接口；详见各项目 README。

3. **Q：License 商业能用吗？**
   A：需看具体协议（Apache-2.0/MIT 多可商用；部分含社区许可需合规）。以仓库 LICENSE 为准。

4. **Q：怎么微调？**
   A：LoRA/QLoRA + 框架（LLaMA-Factory、MS-Swift）；显存不足用量化。

5. **Q：推理性能怎么提？**
   A：量化（GPTQ/AWQ）、KV-cache、批处理、vLLM 连续批处理。

6. **Q：RAG 用什么？**
   A：向量库（Milvus/Qdrant/PGVector）+ 切分+嵌入；见技能/MCP 文档。

7. **Q：模型权重在哪下？**
   A：HuggingFace / ModelScope（魔搭）；国内用 ModelScope 更快。

8. **Q：怎么贡献/提 Issue？**
   A：Fork → 改 → PR；Issue 按模板描述复现步骤。

## 部署要点
- 知识库接官方 README/文档（链接溯源）。
- 推荐模型：开源权重本地；云上用 `deepseek-chat` 等低成本。
- 参见：../技术资料/开源社区-大模型应用指引.md
