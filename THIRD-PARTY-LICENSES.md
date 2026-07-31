# 第三方开源许可声明 / Third-Party Licenses

本项目在「媒体生成 → 文生视频」能力中集成了以下第三方开源项目。我们遵守其许可条款，
并保留其原始版权声明与许可文字。

---

## MoneyPrinterTurbo

- 项目地址：https://github.com/harry0703/MoneyPrinterTurbo
- 许可协议：**MIT License**
- 版权声明：Copyright (c) 2024 Harry
- 集成方式：以 API 模式（FastAPI）独立部署为视频生成 worker，本项目作为编排方调用其 HTTP 接口；
  其自身的 LLM / 素材 API Key 仅存于该 worker 的 `config.toml`，不向本平台前端暴露。
- 修改说明：我们在其基础上新增了「参考文档上传 → AI 浓缩为口播脚本」功能
  （`app/services/document.py` 及 `webui/Main.py` 相关改动），新增文件已标注 AIBAK 扩展声明，
  上游 `LICENSE` 文件保持原样未改动。

### MIT License 全文

```
MIT License

Copyright (c) 2024 Harry

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

如需在网站公开展示开源声明，可新增 `/opensource` 页面并链接本文件。
