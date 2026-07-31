# 🚀 从零到上线变现 — 小白也能看懂的完整教程

> **一句话总结**：这份教程会带你从零开始，把代码变成一个**别人可以访问的网站**，挂上微信支付收款，接入 AI 大模型，最后上线运营赚钱。全程不需要你懂写代码，照着做就行。

---

## 📌 开篇必读：这是网站，不是安装包

### 你的项目是什么？

你手上有一个 **AI Agent 平台** 的代码（已经写好了）。它本质上是一个 **网站** ——就像淘宝、百度、知乎一样：

| | 你的项目 | 对比 |
|---|---|---|
| **交付形式** | 🌐 网站（输入网址访问） | ❌ 不是 .exe / .apk 安装包 |
| **用户怎么用** | 打开浏览器，输入网址，注册登录使用 | ❌ 不需要下载安装 |
| **怎么部署** | 把代码上传到一台服务器，一条命令启动 | ❌ 不是打包成安装文件 |
| **怎么收费** | 用户在网站上选套餐 → 微信扫码支付 → 自动开通 | ❌ 不是卖安装包收钱 |

### 你需要准备什么？

**和"开一家实体店"思路一模一样**：

| 开店步骤 | 对应你的项目 |
|---|---|
| 租店铺 | 买**服务器**（¥50-70/月） |
| 办门牌号 | 买**域名**（¥30-60/年） |
| 办营业执照 | **ICP 备案**（免费，2-4 周） |
| 办收款码 | **微信支付商户号**（你已有） |
| 装修开店 | **一条命令部署**（半天） |
| 进货 | 接入 **AI 模型 API**（1 天） |
| 开门营业 | 网站上线，用户访问 |

---

## 📋 准备工作清单

### 你需要准备的"硬件"

| 序号 | 需要什么 | 去哪弄 | 花多少钱 | 要多久 |
|---|---|---|---|---|
| 1 | 一台服务器 | 腾讯云 / 阿里云 | ¥50-70/月 | 10 分钟 |
| 2 | 一个域名 | 腾讯云 / 阿里云 | ¥30-60/年 | 10 分钟 |
| 3 | 微信支付商户号 | 微信支付平台 | 你已有，¥0 | 已搞定 |
| 4 | DeepSeek API Key | platform.deepseek.com | 充值 ¥1 起步 | 10 分钟 |
| 5 | 腾讯混元密钥 | 腾讯云控制台 | 免费额度 | 10 分钟 |

### 你需要准备的"知识"（别怕，都很简单）

| 技能 | 需要到什么程度 | 教程里有吗 |
|---|---|---|
| 会用电脑浏览器 | ✅ | — |
| 会复制粘贴 | ✅ | ✅ |
| 会打开终端/命令行 | 会复制命令粘贴就行 | ✅ |
| 会用记事本编辑文字 | 就是改 `.env` 文件 | ✅ |
| 写代码 | ❌ 不需要 | — |

---

## 🔧 第一步：买服务器 + 一键部署（半天）

> **做什么**：买一台云服务器，把代码上传上去，一条命令让网站跑起来。
> **完成标志**：在浏览器输入服务器 IP 地址，能看到网站页面。

---

### 1.1 去哪买服务器？

> 💡 **推荐**：腾讯云「轻量应用服务器」— 便宜、自带常用软件、操作简单。

**操作步骤**：

1. 打开浏览器，访问：**https://cloud.tencent.com**
2. 点右上角「**注册**」（用手机号或微信扫码注册）
3. 注册完成后，点「**控制台**」进入管理页面
4. 在左侧菜单找到「**轻量应用服务器**」→ 点「**新建**」

### 1.2 怎么选配置？

在购买页面，这样选：

| 配置项 | 选什么 | 为什么 |
|---|---|---|
| **地域** | 北京 / 上海 / 广州 | 离你近就行 |
| **镜像** | 「**应用镜像**」→ 选「**Docker**」 | 自带 Docker，省去手动安装 |
| **套餐** | **2 核 4G**，系统盘 60G 以上 | 够跑你的项目，¥50-70/月 |
| **时长** | 先买 **3 个月** | ICP 备案要求至少 3 个月 |
| **带宽** | 4M-6M | 够用，千级用户没问题 |

> 💰 首年常有新用户特价，实际可能更便宜。

点「**立即购买**」→ 微信/支付宝付款 → 完成。

### 1.3 怎么连接服务器？

买好后你会得到一个 **IP 地址**（例如 `123.45.67.89`）。接下来要"远程"连上这台服务器。

#### Windows 用户：

1. 按键盘 `Win + R`，输入 `cmd`，回车
2. 在黑色窗口里输入（把 IP 换成你的）：
   ```
   ssh root@你的服务器IP
   ```
3. 会问你要密码。密码去哪找？
   - 回到腾讯云控制台 → 轻量应用服务器 → 点你的服务器 → 点「**重置密码**」
   - 设置一个新密码（记住它！）→ 确定
   - 回到黑窗口，输入这个密码（输入时不显示 `***`，这是正常的）
4. 看到 `Welcome to ...` 就说明连上了！✅

#### Mac 用户：

1. 打开「终端」App（在启动台里找）
2. 输入 `ssh root@你的服务器IP`
3. 输入密码（同上）

### 1.4 上传代码到服务器

代码现在在你电脑上，要传到服务器上。有 3 种方式，任选其一：

#### 方式 A：用 Git 拉取（如果你代码在 GitHub/GitLab 上）

连上服务器后，输入：
```bash
# 安装 git（如果还没装）
apt update && apt install -y git

# 克隆你的代码
git clone https://github.com/你的用户名/ai-agent-platform.git

# 进入项目目录
cd ai-agent-platform
```

#### 方式 B：用 WinSCP 上传（Windows，图形化，推荐小白）

1. 下载安装 WinSCP：https://winscp.net/
2. 打开 WinSCP → 新建连接
   - 主机名：你的服务器 IP
   - 用户名：root
   - 密码：你的服务器密码
3. 点「登录」
4. 左边是你电脑，右边是服务器
5. 把整个 `ai-agent-platform` 文件夹从左拖到右边
6. 等进度条走完，上传完成

#### 方式 C：用 scp 命令上传

在你自己电脑的终端/CMD 里输入（把 IP 换成你的）：
```bash
scp -r "g:/项目成品及测试/AIBAK/reasoni-deepseek/ai-agent-platform" root@你的服务器IP:/root/
```

### 1.5 配置环境变量（非常重要！）

环境变量就是「配置文件」，告诉程序用哪些数据库、接哪个 AI 模型、开什么功能。

连上服务器后：

```bash
# 进入项目目录
cd /root/ai-agent-platform

# 复制生产环境配置模板
cp server/.env.production.example server/.env

# 用 nano 编辑器打开配置文件
nano server/.env
```

在打开的编辑器中，你会看到类似这样的内容。**需要修改的行**用注释标明了：

```
# ===== 服务基础 =====
PORT=3000
NODE_ENV=production
# 👇 改成你的服务器IP（先临时用IP，后面有域名再改）
CLIENT_URL=http://你的服务器IP
PUBLIC_BASE_URL=http://你的服务器IP

# ===== 数据库（不要改，Docker 内部地址）=====
MONGODB_URI=mongodb://mongodb:27017/ai-agent-platform
REDIS_URL=redis://redis:6379

# ===== AI 模型 =====
# 👇 第一步先保持 Mock 模式，后面再切真模型
ENABLE_MOCK_MODE=false
DEFAULT_AI_PROVIDER=deepseek
# 👇 先留空，第四步再填
DEEPSEEK_API_KEY=
HUNYUAN_SECRET_ID=
HUNYUAN_SECRET_KEY=

# ===== 认证 =====
# 👇 必须改！在服务器上执行 openssl rand -hex 32 生成随机字符串
JWT_SECRET=请替换为>=32位随机字符串
# 👇 先保持 mock，第三步再改 wechat
DEFAULT_PAY_PROVIDER=mock
```

**修改完怎么保存**：
- 按 `Ctrl + O` → 回车（保存）
- 按 `Ctrl + X`（退出 nano）

> ⚠️ `JWT_SECRET` 一定要改！在服务器上执行这条命令生成随机密钥：
> ```bash
> openssl rand -hex 32
> ```
> 把输出的字符串复制到 `JWT_SECRET=` 后面。

### 1.6 🔥 一条命令启动（关键时刻！）

一切准备就绪，现在执行这条命令：

```bash
# 先确保在项目目录
cd /root/ai-agent-platform

# 启动所有服务（下载镜像 + 构建 + 启动）
docker-compose up -d
```

**这条命令在干什么？**
- 自动下载 MongoDB、Redis、Node.js 等必要软件
- 自动构建你的前后端代码
- 自动启动 4 个服务（数据库、缓存、后端、前端）
- 一切全自动，你只需要等

**整个过程约 5-10 分钟**（第一次会下载镜像，比较慢）。

看到类似这样的输出就成功了：
```
Creating ai-platform-mongodb ... done
Creating ai-platform-redis   ... done
Creating ai-platform-server  ... done
Creating ai-platform-client  ... done
```

### 1.7 ✅ 如何验证成功？

在你自己电脑的浏览器里，输入：

```
http://你的服务器IP
```

**应该看到什么**：
- 你的 AI Agent 平台网站页面（注册/登录界面）

再验证后端：

```
http://你的服务器IP:3000/api/health
```

应该返回 `{"status":"ok",...}` 之类的 JSON。

**验证清单**：

| 检查项 | 操作 | 正确结果 |
|---|---|---|
| 前端页面 | 浏览器访问 `http://你的IP` | 看到网站首页 |
| 后端 API | 浏览器访问 `http://你的IP:3000/api/health` | 返回 ok |
| 注册功能 | 在首页点注册，填邮箱密码注册 | 注册成功，可登录 |

> ✅ **第一步完成！** 你的网站已经可以通过 IP 访问了。

---

## 🌐 第二步：域名 + 备案 + HTTPS（2-4 周等待）

> **做什么**：买一个好记的域名，提交 ICP 备案，装 SSL 证书让网站有小锁。
> **完成标志**：在浏览器输入 `https://你的域名.com`，能看到网站，地址栏有小锁。

---

### 2.1 买域名

仍然在腾讯云操作（和服务器同一家，后面备案方便）：

1. 打开 **https://cloud.tencent.com** → 进入控制台
2. 左侧菜单 →「**域名注册**」→「**注册域名**」
3. 在搜索框里输入你想要的域名，比如 `myaiagent.com`
4. 选一个没被注册的，价格大概 ¥30-60/年
5. 👉 **重要**：选 `.com` 或 `.cn` 后缀，不要选太冷门的
6. 加入购物车 → 付款 → 完成

> 💡 **取名建议**：简短、好记、和 AI 相关，如 `aibangong.com`、`smartai.cn`

### 2.2 域名解析（把域名指向你的服务器）

1. 腾讯云控制台 →「**域名注册**」→ 点你刚买的域名 →「**解析**」
2. 点「**添加记录**」：
   - **主机记录**：填 `@`（代表主域名）
   - **记录类型**：选 `A`
   - **记录值**：填你的服务器 IP
   - **TTL**：默认 600 即可
3. 再添加一条：
   - **主机记录**：填 `www`
   - **记录类型**：选 `A`
   - **记录值**：填你的服务器 IP

保存后等几分钟，然后在浏览器输入你的域名，应该能看到网站了（和之前用 IP 看到的一样）。

### 2.3 提交 ICP 备案（国内上线必经之路）

> ⚠️ **这是所有步骤里最耗时的一项**，但没办法，中国法律规定境内网站必须备案。

**时间线**：提交 → 腾讯云审核（1-3 天）→ 管局审核（7-20 天）→ 通过 ✅

#### 操作步骤：

1. 腾讯云控制台 → 顶部搜索框搜「**备案**」→ 进入「**ICP 备案**」
2. 点「**开始备案**」
3. 按页面指引填写以下信息：
   - **主体信息**：你的公司名、营业执照号、法人信息等（必须真实）
   - **网站信息**：
     - 网站名称：不要太简单（如"XX 科技"不行），建议"XX AI 智能平台"
     - 网站简介：描述你网站是做什么的
     - 前置审批：一般选「否」
4. 按要求上传：
   - 营业执照照片
   - 法人身份证正反面
   - 域名证书（在域名管理里下载）
5. 提交后，腾讯云会先审核
6. 腾讯云审核通过后，会让你做「人脸核身」认证（微信扫码）
7. 核身通过后，提交到**省通信管理局**审核
8. 等待 7-20 个工作日，会收到短信通知结果

#### 备案通过后做什么？

1. 收到"备案通过"的短信
2. 你会获得一个 **ICP 备案号**（如 粤ICP备XXXXXXXX号）
3. **按工信部要求**，需要在网站底部加上备案号
4. 配置 Nginx 加上备案号（教程附后）

### 2.4 等待备案期间做什么？（别闲着！）

备案要等 2-4 周，期间你可以：

1. ✅ **用 IP 地址访问网站**做功能测试（不影响备案）
2. ✅ **完成第三步微信支付联调**（用测试环境，不需要域名）
3. ✅ **完成第四步 AI 模型接入**
4. ✅ **准备运营内容**（网站介绍文案、定价页面文案）
5. ✅ **测试注册、登录、AI 对话、知识库等所有功能**

### 2.5 配置 SSL 证书（HTTPS，让地址栏有小锁）

备案通过后，给网站加上 HTTPS：

1. 腾讯云控制台 → 搜索「**SSL 证书**」→「**我的证书**」
2. 点「**申请免费证书**」→ 选「**免费版 DV**」→ 确定
3. 填申请信息：
   - 绑定域名：填你的域名（如 `myaiagent.com`）
   - 再添加一条 `www.myaigent.com`
   - 验证方式：选「自动 DNS 验证」
4. 等几分钟，证书签发完成
5. 点「**下载**」→ 选 Nginx → 下载 zip 包

#### 把证书上传到服务器

1. 用 WinSCP 连接服务器（同 1.4 方式 B）
2. 在服务器上创建证书目录：
   ```bash
   mkdir -p /opt/certs
   ```
3. 把下载的证书包里两个文件上传到 `/opt/certs/`：
   - `你的域名_bundle.pem` → 重命名为 `fullchain.pem`
   - `你的域名.key` → 重命名为 `privkey.pem`

#### 启用 HTTPS

连上服务器，执行：

```bash
cd /root/ai-agent-platform

# 1. 修改 docker-compose.yml 的 client 服务
# 把 nginx.conf 换成 nginx.ssl.conf
nano docker-compose.yml
```

在 docker-compose.yml 中找到 `client` 服务部分，修改以下内容：

**原来**：
```yaml
#  client:
#    build: ./client
#    ...
#    ports:
#      - "80:80"
```

**改成**（注意改两个地方：nginx 配置文件和端口）：
你需要修改 `client/` 目录下的 Dockerfile，把 `nginx.conf` 替换为 `nginx.ssl.conf`。

简单做法——直接连上服务器改 Nginx 配置：

```bash
# 2. 把 SSL 模板复制为正式配置
cp client/nginx.ssl.conf client/nginx.conf

# 3. 替换文件里的域名占位符
sed -i 's/你的域名/你真实的域名/g' client/nginx.conf

# 4. 修改 docker-compose.yml 加证书挂载和端口
nano docker-compose.yml
```

在 `client` 服务部分找到 `volumes:` 段，**新增一行**：
```yaml
    volumes:
      - /opt/certs:/etc/nginx/certs:ro   # 👈 新增这行
```

找到 `ports:` 段，修改为：
```yaml
    ports:
      - "80:80"
      - "443:443"   # 👈 新增 HTTPS 端口
```

**保存退出**。

最后，修改 `.env` 把地址改成 HTTPS：
```bash
nano server/.env
```

把：
```
CLIENT_URL=http://你的服务器IP
PUBLIC_BASE_URL=http://你的服务器IP
```

改成：
```
CLIENT_URL=https://你的域名.com
PUBLIC_BASE_URL=https://你的域名.com
```

**重启服务**：
```bash
# 重新构建并启动
docker-compose up -d --build

# 等 2-3 分钟后验证
```

### 2.6 ✅ 如何验证成功？

| 检查项 | 操作 | 正确结果 |
|---|---|---|
| 域名访问 | 浏览器输入 `http://你的域名.com` | 自动跳转到 `https://` |
| HTTPS 小锁 | 看地址栏左边 | 有小锁图标 🔒 |
| SSL 证书 | 点小锁查看证书 | 显示"连接安全"、证书有效 |
| API HTTPS | 访问 `https://你的域名.com/api/health` | 返回 ok |

> ✅ **第二步完成！** 网站有正式域名 + HTTPS 加密 + ICP 备案号。

---

## 💰 第三步：微信支付真实验签联调（1-2 天）

> **做什么**：接入真实的微信支付，让用户可以用微信扫码付款买套餐。
> **完成标志**：在网站下单 → 微信扫码付 ¥0.01 → 支付成功 → 会员自动开通。

---

### 3.1 前置条件检查

在开始之前，确认以下条件：

| 条件 | 状态 | 说明 |
|---|---|---|
| ✅ 域名备案完成 | 必须 | 微信支付回调需要公网 HTTPS |
| ✅ HTTPS 已配置 | 必须 | 微信要求回调地址是 HTTPS |
| ✅ 有微信支付商户号 | 你已有 | 公司主体申请的 |
| ✅ 商户号有 JSAPI 支付权限 | 需要确认 | 登录微信支付商户平台查看 |

### 3.2 获取微信支付商户号参数

登录 **微信支付商户平台**：https://pay.weixin.qq.com

#### 要获取的参数清单：

| 参数名 | 去哪找 | 对应 .env 变量 |
|---|---|---|
| 商户号 | 首页 → 商户信息 | `WECHAT_MCH_ID` |
| AppID | 产品中心 → AppID 账号管理 | `WECHAT_APP_ID` |
| APIv3 密钥 | 账户中心 → API 安全 → 设置 APIv3 密钥 | `WECHAT_API_V3_KEY` |
| 证书序列号 | 账户中心 → API 安全 → 申请 API 证书 | `WECHAT_CERT_SERIAL` |
| 商户私钥 | 下载 API 证书包里的 `apiclient_key.pem` | `WECHAT_PRIVATE_KEY` |

#### 详细步骤：

**1. 获取商户号（MCH_ID）**
- 登录商户平台 → 首页右上角就能看到「商户号」
- 是一串数字，如 `1234567890`
- 记下来

**2. 获取 AppID**
- 商户平台 →「产品中心」→「AppID 账号管理」
- 关联你的公众号/小程序 AppID
- 如果没有，先注册一个微信服务号或小程序
- 记下 AppID

**3. 设置 APIv3 密钥**
- 商户平台 →「账户中心」→「API 安全」
- 找到「APIv3 密钥」→ 点「设置」
- 生成一个 32 位随机字符串（可以用这个命令生成）：
  ```bash
  openssl rand -hex 16
  ```
- 复制保存好！**只显示一次**

**4. 申请 API 证书**
- 还是在「API 安全」页面
- 找到「API 证书」→ 点「申请证书」
- 按提示下载工具生成证书
- 下载证书压缩包，里面有两个文件：
  - `apiclient_key.pem`（私钥）
  - `apiclient_cert.pem`（证书）
- 证书序列号在商户平台页面上会显示

**5. 配置支付回调地址**
- 商户平台 →「产品中心」→「开发配置」
- 找到「支付回调 URL」
- 填入：`https://你的域名.com/api/billing/webhook/wechat`

### 3.3 填入 .env 配置

连上服务器，编辑环境变量：

```bash
nano /root/ai-agent-platform/server/.env
```

修改以下内容：

```
# ===== 支付 =====
# 👇 从 mock 改成 wechat
DEFAULT_PAY_PROVIDER=wechat

# ===== 微信支付 v3 =====
# 👇 填入你上面收集的参数
WECHAT_MCH_ID=你商户号那串数字
WECHAT_APP_ID=你的微信AppID
WECHAT_API_V3_KEY=你设置的32位密钥
WECHAT_CERT_SERIAL=证书序列号
# 👇 把 apiclient_key.pem 里的内容直接粘贴（保留所有换行和-----）
WECHAT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----
你的私钥内容...
-----END PRIVATE KEY-----
# 👇 改成你的域名
WECHAT_NOTIFY_URL=https://你的域名.com/api/billing/webhook/wechat
```

保存退出。

### 3.4 真实验签测试

```bash
# 重启服务使配置生效
cd /root/ai-agent-platform
docker-compose restart server
```

等 1 分钟后，在浏览器打开你的网站：

1. 登录 → 进入「个人中心」
2. 选择一个付费套餐（专业版 ¥39 或旗舰版 ¥99）
3. 点「立即购买」
4. 应该弹出微信支付页面
5. 用微信扫码支付 ¥0.01（首测用最小金额）

### 3.5 用 ¥0.01 做端到端测试

> ⚠️ 第一次测试建议用最小金额测试整条流程。

**测试链路**：
1. 网站下单 → 2. 微信扫码 → 3. 扣款成功 → 4. 微信回调你的服务器 → 5. 服务器验签 → 6. 会员自动开通

**验证方法**：

| 检查项 | 怎么验证 | 正确结果 |
|---|---|---|
| 下单成功 | 点购买后看页面 | 跳转到微信支付页面 |
| 能扫码 | 微信扫二维码 | 显示付款金额 |
| 支付成功 | 付完查看微信 | 微信通知扣款成功 |
| 回调验签 | 查看服务器日志 | `docker-compose logs server` 看到 `webhook verified` |
| 会员开通 | 回到网站个人中心 | 会员等级变成你买的套餐 |
| 到期降级 | 会员到期后 | 自动降为免费版 |

### 3.6 ✅ 如何验证成功？

用真钱（¥0.01）完整走通一次：**下单 → 支付 → 回调 → 验签 → 会员开通**，全部成功。

> ✅ **第三步完成！** 用户可以微信支付买套餐，平台开始有收入。

---

## 🤖 第四步：AI 模型 / 媒体生成真实厂商联调（1 天）

> **做什么**：把 Mock 假数据关掉，接入真实的 AI 大模型——对话、文生图、媒体生成全用真模型。
> **完成标志**：在网站发消息 → DeepSeek 真实回复 → AI 绘画出图 → 一切正常。

---

### 4.1 接入 DeepSeek（对话/代码，必做，最便宜）

DeepSeek 是目前国产最便宜的 AI 模型，对话成本 ¥1/百万字，强烈推荐。

#### 注册获取 API Key：

1. 浏览器打开：**https://platform.deepseek.com**
2. 点右上角「**注册**」→ 用手机号注册
3. 注册后进入控制台 → 左侧「**API Keys**」
4. 点「**创建 API Key**」→ 起个名字如「我的平台」→ 创建
5. 📋 **立刻复制保存**！只显示一次
6. 👉 还需要充值：左侧「**充值**」→ 选金额（先充 ¥1 就够了）

### 4.2 接入腾讯混元（文生图/媒体生成，推荐）

腾讯混元能同时做对话和图片/视频生成，国内调用稳定。

#### 获取密钥（SecretId + SecretKey）：

1. 打开：**https://console.cloud.tencent.com/cam/capi**
2. 登录腾讯云（和买服务器同一个账号就行）
3. 点「**新建密钥**」
4. 得到 `SecretId` 和 `SecretKey`
5. 📋 **立刻复制保存**！SecretKey 只显示一次

6. 还需要开通混元服务：
   - 打开：**https://console.cloud.tencent.com/hunyuan**
   - 点「**开通服务**」→ 同意协议 → 确认
   - 新用户有免费额度

### 4.3 （可选）接入其他模型

你的平台还支持这些模型，按需接入：

| 模型 | 去哪注册 | 用途 |
|---|---|---|
| 通义千问 | https://dashscope.aliyun.com | 阿里系模型 |
| 智谱 GLM | https://open.bigmodel.cn | 清华系模型 |
| 豆包 | https://www.volcengine.com | 字节系模型 |
| OpenAI | https://platform.openai.com | GPT 系列（海外，需梯子） |
| Claude | https://console.anthropic.com | Anthropic 模型（海外） |

### 4.4 填入 .env 配置

连上服务器：

```bash
nano /root/ai-agent-platform/server/.env
```

修改以下内容：

```
# ===== AI 模型 =====
# 👇 关掉 Mock 模式
ENABLE_MOCK_MODE=false
# 👇 默认对话用 DeepSeek（最便宜）
DEFAULT_AI_PROVIDER=deepseek

# 👇 填入你的真实 Key
DEEPSEEK_API_KEY=sk-你从DeepSeek复制的key
HUNYUAN_SECRET_ID=AKIDxxxxxxxx  # 腾讯云的 SecretId
HUNYUAN_SECRET_KEY=xxxxxxxxxxxx  # 腾讯云的 SecretKey

# 👇 以下选填
QWEN_API_KEY=           # 如果你申请了通义千问
OPENAI_API_KEY=         # 如果你申请了 OpenAI
ANTHROPIC_API_KEY=      # 如果你申请了 Claude
```

保存退出。

### 4.5 重启并验证

```bash
cd /root/ai-agent-platform

# 重启后端服务
docker-compose restart server

# 查看日志（确认没有报错）
docker-compose logs -f server
```

看到日志没有红色报错后（1-2 分钟），在浏览器打开你的网站测试。

### 4.6 ✅ 如何验证成功？

| 测试项 | 怎么测 | 正确结果 |
|---|---|---|
| AI 对话 | 在对话框发「你好，你是谁」 | 真实回复（不是"这是 Mock 回复"） |
| 知识问答 | 问「介绍一下人工智能」 | DeepSeek 真实回答 |
| 代码解释 | 粘贴一段代码点解释 | 真实解释 |
| AI 绘画 | 输入提示词「一只猫」点生成 | 生成真实图片 |
| 媒体生成 | 用媒体生成功能 | 混元生成真实内容 |

> ✅ **第四步完成！** AI 功能全部接入真实模型，用户获得真正的 AI 体验。

---

## 🧪 第五步：测试清理 + 最终质量检查（1 天）

> **做什么**：跑一遍全部测试，确保代码没有错误；运行 Lint 检查代码风格；做最后上线前检查。
> **完成标志**：所有测试通过、Lint 零错误、所有功能正常。

---

### 5.1 运行测试套件

连上服务器（或在你自己电脑上）：

```bash
cd /root/ai-agent-platform

# 安装依赖（如果还没有）
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..

# 运行全部测试
npm run test
```

**期望输出**：
```
Test Suites: XX passed, XX total
Tests:       XX passed, XX total
```

如果有失败的测试，记录错误信息，修复后重测。

### 5.2 运行 Lint 检查

```bash
npm run lint
```

**期望输出**：没有任何错误信息（或者 `0 errors, 0 warnings`）

如果有报错：
```bash
# 尝试自动修复
npm run format
# 再跑一次 lint
npm run lint
```

### 5.3 运行构建验证

```bash
npm run build
```

**期望输出**：`build success` 或类似信息，没有红色报错。

这步验证代码能正常打包，确保部署时不会编译失败。

### 5.4 回归测试清单（手动测试）

把网站所有核心功能手动过一遍：

| 模块 | 检查项 | ✅ |
|---|---|---|
| **用户系统** | 注册新账号 | ☐ |
| | 登录 | ☐ |
| | 修改个人信息 | ☐ |
| | 退出登录 | ☐ |
| **AI 对话** | 发送消息 | ☐ |
| | 多轮对话 | ☐ |
| | 切换模型 | ☐ |
| **知识库** | 创建文档 | ☐ |
| | 编辑文档 | ☐ |
| | 搜索文档 | ☐ |
| **支付** | 浏览定价页 | ☐ |
| | 选择套餐 | ☐ |
| | 微信支付 | ☐ |
| | 会员开通 | ☐ |
| **智能客服** | 创建客服 | ☐ |
| | 测试问答 | ☐ |
| | 满意度评分 | ☐ |
| **工具箱** | AI 绘画 | ☐ |
| | 文档转换 | ☐ |
| | 方案生成 | ☐ |

### 5.5 ✅ 如何验证成功？

| 检查项 | 标准 | ✅ |
|---|---|---|
| `npm run test` | 全部通过，无失败 | ☐ |
| `npm run lint` | 0 errors, 0 warnings | ☐ |
| `npm run build` | 构建成功 | ☐ |
| 回归测试 | 所有核心功能正常 | ☐ |
| 支付测试 | ¥0.01 端到端走通 | ☐ |
| AI 测试 | 真实模型回复正常 | ☐ |

> ✅ **第五步完成！** 所有测试通过，平台可以正式上线运营！

---

## 📊 完整时间线总览

```
第 1 天上午：买服务器 → 上传代码 → 一条命令部署 → 网站可访问 ✅
第 1 天下午：买域名 → 配置解析 → 域名可访问 ✅
第 1-3 天：    提交 ICP 备案 → 腾讯云审核 → 人脸核身
第 1-2 周：    等管局审核（期间完成 AI 模型接入 + 支付联调）
第 3-4 周：    备案通过 → 配置 HTTPS → 正式上线 🎉
```

> 💡 **关键并行策略**：备案等待期间，你有 2-4 周时间做 AI 模型接入和支付联调，不要干等！

---

## 📎 附录 A：常见问题排查

### 问题 1：`docker-compose up -d` 报错

**错误**：`Cannot connect to the Docker daemon`

**解决**：
```bash
# 启动 Docker 服务
systemctl start docker
systemctl enable docker
# 再试一次
docker-compose up -d
```

### 问题 2：网站访问不了

**排查步骤**：
1. 检查服务器防火墙是否开放了 80 端口（HTTP）和 443 端口（HTTPS）
2. 腾讯云控制台 → 轻量服务器 →「防火墙」→ 确保有 80/TCP 和 443/TCP 规则

### 问题 3：微信支付回调失败

**排查**：
1. 确认域名有 HTTPS（微信要求）
2. 确认 `WECHAT_NOTIFY_URL` 填的地址 https 开头
3. 查看日志：`docker-compose logs server | grep wechat`
4. 确认商户号、密钥、证书都正确

### 问题 4：AI 调用返回 Mock 数据

**原因**：`ENABLE_MOCK_MODE` 还是 `true`

**解决**：
```bash
nano server/.env
# 确保 ENABLE_MOCK_MODE=false
# 确保对应的 API Key 已填入
docker-compose restart server
```

### 问题 5：MongoDB 连接失败

**查看状态**：
```bash
docker-compose ps
# 看看 mongodb 服务是不是 Up 状态
```

如果不是，重启：
```bash
docker-compose restart mongodb
```

---

## 📎 附录 B：日常运维指南

### 日常检查

```bash
# 查看所有服务状态
docker-compose ps

# 查看最近的日志
docker-compose logs --tail=50

# 查看资源使用
docker stats
```

### 数据备份（每月做一次）

```bash
# 备份 MongoDB
docker exec ai-platform-mongodb mongodump --out /data/backup
docker cp ai-platform-mongodb:/data/backup ./mongodb-backup-$(date +%Y%m%d)
```

### 更新代码

```bash
cd /root/ai-agent-platform

# 拉取最新代码
git pull

# 重新构建并启动
docker-compose up -d --build
```

### 重启服务

```bash
# 全部重启
docker-compose restart

# 只重启后端
docker-compose restart server

# 完全停止
docker-compose down

# 启动
docker-compose up -d
```

---

## 🎉 恭喜！

到这里，你已经完成了一个完整的 SaaS 平台从零到上线的全过程：

1. ✅ 买了服务器，一条命令部署成功
2. ✅ 买了域名，完成 ICP 备案，配置 HTTPS
3. ✅ 微信支付接入，可以真收款
4. ✅ AI 模型接入，真实对话/绘画/媒体生成
5. ✅ 所有测试通过，质量有保障

**接下来你可以**：
- 在自己的朋友圈/微信群/社交媒体宣传网站
- 邀请种子用户免费试用
- 根据用户反馈优化产品
- 开始有收入！

---

> 📅 最后更新：2026-07-09
> 📝 版本：v1.0
