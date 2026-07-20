import { Typography, Divider, Table, Alert } from "antd";

const { Title, Paragraph, Text } = Typography;

const INFO_TABLE = [
  { key: "1", category: "身份信息", items: "手机号码、邮箱地址、昵称、头像、第三方登录标识（微信/飞书等授权后获取的公开信息）", purpose: "账户注册与实名核验、登录认证、安全风控、客服联系", retention: "账户存续期间；账号注销后依法保留必要的安全审计记录" },
  { key: "2", category: "交互内容", items: "对话输入与输出（文本/图片/文件/语音）、上传的知识文档、技能配置、工作流编排、代码执行请求", purpose: "提供 AI 对话、知识管理、代码沙盒、工具调用、技能市场等核心服务", retention: "账户存续期间；您可随时删除；已删除内容30天内从备份中彻底清除" },
  { key: "3", category: "支付与财务", items: "订单编号、交易金额、支付渠道流水号、退款记录、积分账本明细", purpose: "订单处理、退款管理、财务对账、反欺诈", retention: "按《电子商务法》要求至少保留3年；积分流水按财会准则长期保存" },
  { key: "4", category: "设备与日志", items: "IP 地址、浏览器类型与版本、操作系统、设备标识符、访问时间戳、页面浏览与点击行为", purpose: "安全防护、故障诊断、访问统计、产品优化", retention: "安全日志至少保留6个月（符合《网络安全法》要求）；一般访问日志90天" },
  { key: "5", category: "API 用量", items: "调用模型名称、请求时间、Token 消耗量、响应状态码", purpose: "额度统计、计费结算、服务质量监控", retention: "账户存续期间，用于用量查询与账单核验" },
  { key: "6", category: "客服沟通", items: "咨询问题描述、上传的证明材料、沟通记录", purpose: "处理投诉建议、售后支持、争议解决", retention: "处理完毕后保留2年备查" },
];

const SHARING_TABLE = [
  { key: "1", name: "微信支付（财付通）", purpose: "支付处理、退款执行、账单对账", dataShared: "订单号、金额、商品描述；不共享您的知识内容与对话记录", policyUrl: "https://pay.weixin.qq.com/index.php/public/apply_sign/protocol_v2" },
  { key: "2", name: "AI 模型服务商（接入选定厂商）", purpose: "处理对话生成与内容分析请求", dataShared: "您主动输入的对话文本与系统提示词；不含账户注册信息", policyUrl: "参见各厂商官方网站" },
  { key: "3", name: "腾讯云计算（CloudBase / COS）", purpose: "应用托管、文件与备份存储", dataShared: "应用运行数据、上传文件", policyUrl: "https://cloud.tencent.com/document/product/301" },
  { key: "4", name: "通知推送服务", purpose: "发送邮件通知、告警与验证码", dataShared: "通知内容与接收地址（邮箱/手机号）", policyUrl: "参见对应服务商隐私政策" },
  { key: "5", name: "实名认证服务商", purpose: "实名身份核验", dataShared: "姓名、身份证号、手机号（您主动提供）", policyUrl: "参见对应认证服务商隐私政策" },
];

export default function PrivacyPage() {
  return (
    <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <Title level={2}>隐私政策</Title>
      <Paragraph type="secondary">版本 2.0 · 生效日期：2026-07-20</Paragraph>
      <Divider />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 24, borderRadius: 12 }}
        message="重要提示"
        description={
          <span>
            本政策涉及您的个人信息权益，请仔细阅读。<Text strong>加粗</Text>条款与您的权利密切相关。
            如政策发生重大变更，我们将通过平台公告、邮件或站内信通知您，并在您再次登录时取得明确同意。
          </span>
        }
      />

      {/* ─── 导言 ─── */}
      <Title level={4}>引言</Title>
      <Paragraph>
        <Text strong>AIbak</Text>（域名为 aibak.site，下称"本平台"或"我们"）是由平台运营主体提供的
        一站式 AI 应用服务，涵盖 AI 智能对话、通用知识库、代码沙盒、智能工具箱、技能市场、开放 API、
        团队协作、会员订阅与分销推广等功能。我们充分认识到个人信息对您的重要性，将严格遵循
        《中华人民共和国个人信息保护法》《中华人民共和国网络安全法》《中华人民共和国数据安全法》
        等法律法规，采取合法、正当、必要、诚信的原则处理您的个人信息。
      </Paragraph>
      <Paragraph>本政策适用于本平台的网页端、H5端以及后续可能推出的移动应用程序。</Paragraph>
      <Paragraph>
        您在使用我们的服务前，请仔细阅读本政策。如您对本政策有任何疑问，可通过文末联系方式与我们沟通。
        如您不同意本政策的任何内容，请停止注册或使用本平台。继续使用即表示您已充分理解并同意本政策。
      </Paragraph>

      <Divider />

      {/* ─── 第1条 ─── */}
      <Title level={4}>一、我们收集哪些信息</Title>
      <Paragraph>
        我们仅收集为实现各项平台功能所必需的信息，您可选择不提供非必要信息，不影响基本功能的正常使用。
        各功能对应的信息收集详情如下表所示：
      </Paragraph>
      <Table
        size="middle"
        pagination={false}
        style={{ marginBottom: 20 }}
        columns={[
          { title: "信息类别", dataIndex: "category", width: 110 },
          { title: "具体内容", dataIndex: "items" },
          { title: "使用目的", dataIndex: "purpose" },
          { title: "保存期限", dataIndex: "retention", width: 170 },
        ]}
        dataSource={INFO_TABLE}
      />
      <Paragraph>
        <Text strong>敏感权限声明：</Text>当您需要上传图片时，我们会申请相册/相机权限；当您使用语音输入时，
        我们会申请麦克风权限。上述权限均不会默认开启，仅在您主动触发相关功能并明确授权后调用。
      </Paragraph>
      <Paragraph>
        <Text strong>特别说明：</Text>在以下情形中，我们收集和使用您的个人信息无需事先取得您的同意——
        （1）履行法定职责或法定义务所必需；（2）与国家安全、国防安全直接相关；
        （3）与公共安全、公共卫生、重大公共利益直接相关；（4）与刑事侦查、起诉、审判和判决执行直接相关；
        （5）为维护您或他人的生命、财产等重大合法权益所必需但又难以取得本人同意；
        （6）您自行向社会公众公开的信息；（7）法律、行政法规规定的其他情形。
      </Paragraph>

      <Divider />

      {/* ─── 第2条 ─── */}
      <Title level={4}>二、我们如何使用 Cookie 和同类技术</Title>
      <Paragraph>
        我们使用 Cookie、localStorage 和类似技术来保障服务正常运行，主要目的包括：
      </Paragraph>
      <Paragraph>
        <ul>
          <li><Text strong>登录维持：</Text>识别您的登录状态，避免重复输入账号密码。</li>
          <li><Text strong>偏好记忆：</Text>记录语言选择、界面主题等个性化设置。</li>
          <li><Text strong>安全防护：</Text>检测异常登录、恶意访问和自动化攻击行为。</li>
          <li><Text strong>统计分析：</Text>匿名化地统计页面访问量和使用行为，优化产品体验。</li>
        </ul>
      </Paragraph>
      <Paragraph>
        您可在浏览器设置中清除或禁用 Cookie，但这可能导致部分功能无法正常使用。
        详情请参见我们的 <a href="/cookies">Cookies 政策</a>。
      </Paragraph>

      <Divider />

      {/* ─── 第3条 ─── */}
      <Title level={4}>三、我们如何委托处理与共享您的信息</Title>
      <Paragraph>
        我们不会出售您的个人信息。仅在下列必要场景下，我们可能与第三方合作伙伴共享有限信息：
      </Paragraph>
      <Table
        size="middle"
        pagination={false}
        style={{ marginBottom: 20 }}
        columns={[
          { title: "合作方", dataIndex: "name", width: 170 },
          { title: "用途", dataIndex: "purpose" },
          { title: "共享数据范围", dataIndex: "dataShared" },
        ]}
        dataSource={SHARING_TABLE}
      />
      <Paragraph>
        <Text strong>共同处理与委托处理：</Text>对于上述共享场景，我们将与合作方签订数据处理协议，
        明确约定各自的权利义务，并要求其采取至少同等水平的安全保护措施。
        未经您的明确同意，我们不会将您的个人信息用于上述场景之外的任何用途。
      </Paragraph>
      <Paragraph>
        <Text strong>无需同意的例外：</Text>根据法律法规规定，在涉及国家安全、公共安全、
        刑事侦查、司法程序等法定情形下，我们可能依法提供您的个人信息，无需另行取得您的同意。
      </Paragraph>

      <Divider />

      {/* ─── 第4条 ─── */}
      <Title level={4}>四、AI 模型数据处理特别说明</Title>
      <Paragraph>
        本平台聚合对接了多家大语言模型及图像生成模型服务商。当您发起 AI 对话、代码解释、
        图片生成等请求时，您输入的文本、图片或文件将按模型路由规则发送至您所选或系统分配的模型服务商服务器。
        我们不会将您的账户注册信息（手机号、邮箱等）发送给模型服务商。
      </Paragraph>
      <Paragraph>
        <Text strong>数据用于模型训练：</Text>默认情况下，我们不会主动将您的对话数据提供给模型厂商
        用于其模型训练。若您选择使用平台提供的"免费体验"入口，部分内置免费模型可能遵循
        各自厂商的数据使用政策，请在使用前了解相应厂商的隐私条款。
      </Paragraph>
      <Paragraph>
        <Text strong>安全提示：</Text>请在对话中避免输入身份证号码、银行卡信息、密码口令、
        精确家庭地址等敏感个人信息。若需处理含个人信息的内容，建议事先进行脱敏处理。
      </Paragraph>

      <Divider />

      {/* ─── 第5条 ─── */}
      <Title level={4}>五、AI 生成内容风险告知</Title>
      <Paragraph>
        <ul>
          <li>AI 生成的所有内容均由算法模型自动产出，不代表本平台观点或立场。</li>
          <li>AI 输出可能存在事实错误、逻辑不一致或不当表述，不应替代专业法律、医疗、金融等建议。</li>
          <li>用户不得利用本平台生成或传播违法信息、虚假信息、侵权内容或危害国家安全的内容。</li>
          <li>本平台已部署内容安全过滤机制，但无法保证对所有违规内容的绝对拦截，用户需自行承担使用 AI 内容的风险。</li>
        </ul>
      </Paragraph>

      <Divider />

      {/* ─── 第6条 ─── */}
      <Title level={4}>六、信息的存储与跨境传输</Title>
      <Paragraph>
        <Text strong>存储地点：</Text>我们在中华人民共和国境内运营中收集和产生的所有个人信息，
        均存储在境内服务器中。我们不会主动将您的个人信息传输或存储至境外。
      </Paragraph>
      <Paragraph>
        <Text strong>跨境传输情形：</Text>当您主动选择调用境外模型服务商（如 OpenAI、Anthropic 等）时，
        您的对话输入内容可能被传输至该服务商位于境外的服务器，此种传输基于您的主动选择和同意。
        我们将通过平台交互界面就此类跨境传输向您做出明确提示。
      </Paragraph>

      <Divider />

      {/* ─── 第7条 ─── */}
      <Title level={4}>七、我们如何保护您的信息</Title>
      <Paragraph>
        我们已实施多层次安全措施来保护您的个人信息，包括但不限于：
      </Paragraph>
      <Paragraph>
        <ul>
          <li><Text strong>传输安全：</Text>全站采用 HTTPS/TLS 加密传输。</li>
          <li><Text strong>存储安全：</Text>敏感字段采用 AES-256-GCM 加密存储，密钥定期轮换。</li>
          <li><Text strong>访问控制：</Text>基于角色的最小权限访问管理制度。</li>
          <li><Text strong>安全审计：</Text>记录管理员操作日志，关键操作需多重授权。</li>
          <li><Text strong>漏洞管理：</Text>定期进行安全评估与渗透测试。</li>
          <li><Text strong>备份恢复：</Text>数据库每日自动备份，异地容灾存储。</li>
        </ul>
      </Paragraph>
      <Paragraph>
        如不幸发生个人信息安全事件，我们将按照法律法规要求，及时告知您事件基本情况、
        可能的影响及我们已采取的处置措施，并按规定向监管部门报告。
      </Paragraph>

      <Divider />

      {/* ─── 第8条 ─── */}
      <Title level={4}>八、您的个人信息权利</Title>
      <Paragraph>
        根据《个人信息保护法》等法律法规，您对自身个人信息享有以下权利，我们为您提供相应的行使路径：
      </Paragraph>
      <Paragraph>
        <ul>
          <li>
            <Text strong>查阅与复制：</Text>
            您可在"个人中心"查看您的账户信息、订单记录和积分流水。
            如需获取完整个人信息副本，可通过"个人中心 → 数据导出"提交申请，
            导出文件包含个人资料、订单、积分明细及对话记录摘要，下载链接 24 小时内有效。
          </li>
          <li>
            <Text strong>更正与补充：</Text>
            如您发现个人信息不准确或不完整，可在"个人中心"自行修改，或联系客服协助更正。
          </li>
          <li>
            <Text strong>删除：</Text>
            您可在平台内直接删除已创建的知识文档和对话记录。
            如您要求删除其他个人信息，可通过"个人中心 → 账号注销"或联系客服提出申请，
            我们将在 15 个工作日内完成处理，法律另有规定除外。
          </li>
          <li>
            <Text strong>账号注销：</Text>
            您可在"个人中心 → 账号注销"提交注销申请。注销设有 7 天冷静期，
            期间重新登录可自动撤销。注销完成后，您的个人信息将被删除或匿名化处理，
            但依法必须保留的财务支付记录和安全审计日志除外。
          </li>
          <li>
            <Text strong>撤回授权：</Text>
            对于基于您同意而进行的个人信息处理活动，您可随时在设备系统设置中
            关闭相机、麦克风等权限，或联系客服撤回其他授权。撤回不影响此前已进行处理的合法性。
          </li>
        </ul>
      </Paragraph>
      <Paragraph>
        我们将在收到您的权利请求后 15 个工作日内完成核验并回复。
        对于重复提交、超出合理范围或技术手段无法实现的请求，我们有权予以拒绝并说明理由。
      </Paragraph>

      <Divider />

      {/* ─── 第9条 ─── */}
      <Title level={4}>九、未成年人保护</Title>
      <Paragraph>
        <ul>
          <li>本平台主要面向年满 18 周岁的成年用户。未满 18 周岁的用户须在监护人的陪同和指导下使用。</li>
          <li>我们原则上不主动收集未满 14 周岁儿童的个人信息。</li>
          <li>
            如我们发现未经其监护人有效同意而收集了儿童个人信息，将立即采取措施删除相关数据。
          </li>
          <li>
            监护人如对本平台处理其监护儿童个人信息的方式有任何疑问，
            可通过本政策列明的联系方式与我们沟通，行使查阅、更正、删除等权利。
          </li>
        </ul>
      </Paragraph>

      <Divider />

      {/* ─── 第10条 ─── */}
      <Title level={4}>十、政策更新</Title>
      <Paragraph>
        我们可能根据业务发展或法律法规变化适时修订本政策。政策修订后将更新本页面的生效日期。
      </Paragraph>
      <Paragraph>
        对于<Text strong>重大变更</Text>（包括但不限于：处理目的变更、新增敏感信息收集、数据共享范围扩大等），
        我们将通过以下一种或多种方式通知您：站内弹窗公告、邮件通知、短信提示。
        重大变更内容将在您重新登录时明确展示，需您勾选同意后方才生效。
        您不同意变更内容的，可选择停止使用或注销账号。
      </Paragraph>

      <Divider />

      {/* ─── 第11条 ─── */}
      <Title level={4}>十一、联系我们</Title>
      <Paragraph>
        如您对本隐私政策有任何疑问、意见、建议或投诉，或希望行使上述个人信息权利，
        请通过以下方式与我们联系：
      </Paragraph>
      <Paragraph>
        <ul>
          <li><Text strong>电子邮箱：</Text>xmwcg5059@outlook.com（个人信息保护专员）</li>
          <li><Text strong>在线客服：</Text>访问 <a href="/contact">联系我们</a> 页面提交，或点击网站左侧悬浮客服按钮</li>
          <li><Text strong>微信客服：</Text>添加微信 aibak-service，备注"Aibak隐私咨询"</li>
          <li><Text strong>办公时间：</Text>周一至周日 9:00 – 21:00（北京时间）</li>
        </ul>
      </Paragraph>
      <Paragraph>
        我们将在验证您的身份后 15 个工作日内予以回复。如您对我们的处理结果不满意，
        您还可以向履行个人信息保护职责的监管部门投诉或向人民法院提起诉讼。
      </Paragraph>

      <Divider />

      {/* ─── 附则 ─── */}
      <Paragraph type="secondary" style={{ fontSize: 12 }}>
        本政策以中文版本为准，其他语言版本仅供参考。
        本政策未定义的名词，参照《服务条款》中的定义。
        本政策的最终解释权归本平台运营主体所有。
      </Paragraph>
      <Paragraph type="secondary" style={{ fontSize: 12 }}>
        © {new Date().getFullYear()} AIbak · aibak.site · All rights reserved.
      </Paragraph>
    </div>
  );
}