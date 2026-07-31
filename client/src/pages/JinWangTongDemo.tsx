import React, { useState, useRef } from 'react';
import { Modal, message } from 'antd';
import { useAuthStore } from '@/stores/auth';
import { useNavigate } from 'react-router-dom';
import {
  Card, Typography, Button, Space, Row, Col, Tag, Descriptions, Table,
  Progress, Steps, Divider, Statistic, Tabs, Collapse, Empty, Result,
  Form, Select, Input, InputNumber, DatePicker,
} from 'antd';
import {
  DesktopOutlined, LaptopOutlined, PrinterOutlined, WifiOutlined,
  ScanOutlined, DatabaseOutlined, SafetyOutlined, ThunderboltOutlined,
  PlayCircleOutlined, DownloadOutlined, CrownOutlined, CheckCircleOutlined,
  ClockCircleOutlined, CloseCircleOutlined, ClusterOutlined,
  AppstoreOutlined, CodeOutlined, AuditOutlined, GlobalOutlined,
  FileProtectOutlined, SwapOutlined, ShoppingCartOutlined, WechatOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import { billingAPI, extractApiError } from '@/services/api';

const WEWORK_KF_URL = 'https://work.weixin.qq.com/kfid/kfce20d584b0179916f';
const PERSONAL_WECHAT_QR = '/wechat-qr.png';
const SERVICE_PHONE = '13599530881';

const { Title, Paragraph, Text } = Typography;

// ========== IT 资产品牌数据库 ==========
interface BrandOption {
  value: string;
  label: string;
  models: { value: string; label: string }[];
}

interface AssetCategory {
  value: string;
  label: string;
  brands: BrandOption[];
}

const ASSET_CATEGORIES: AssetCategory[] = [
  {
    value: 'desktop', label: '台式机',
    brands: [
      { value: 'lenovo', label: '联想', models: [{ value: 'qitian', label: '启天' }, { value: 'yangtian', label: '扬天' }, { value: 'thinkcentre', label: 'ThinkCentre' }] },
      { value: 'dell', label: '戴尔', models: [{ value: 'optiplex', label: 'OptiPlex' }, { value: 'vostro', label: 'Vostro' }] },
      { value: 'hp', label: '惠普', models: [{ value: 'elitedesk', label: 'EliteDesk' }, { value: 'prodesk', label: 'ProDesk' }] },
      { value: 'huawei', label: '华为', models: [{ value: 'matestation', label: 'MateStation' }] },
      { value: 'asus', label: '华硕', models: [{ value: 'rog', label: 'ROG' }, { value: 'proart', label: 'ProArt' }] },
      { value: 'acer', label: '宏碁', models: [{ value: 'veriton', label: 'Veriton' }] },
      { value: 'tsinghua_tongfang', label: '清华同方', models: [{ value: 'chaoyue', label: '超越系列' }] },
      { value: 'inspur', label: '浪潮', models: [{ value: 'yingxin', label: '英信系列' }] },
    ],
  },
  {
    value: 'laptop', label: '笔记本',
    brands: [
      { value: 'lenovo', label: '联想', models: [{ value: 'thinkpad_x1', label: 'ThinkPad X1' }, { value: 'thinkpad_t', label: 'ThinkPad T' }, { value: 'thinkpad_e', label: 'ThinkPad E' }, { value: 'yoga', label: 'YOGA' }, { value: 'xiaoxin', label: '小新' }] },
      { value: 'dell', label: '戴尔', models: [{ value: 'latitude', label: 'Latitude' }, { value: 'xps', label: 'XPS' }, { value: 'inspiron', label: 'Inspiron' }] },
      { value: 'hp', label: '惠普', models: [{ value: 'elitebook', label: 'EliteBook' }, { value: 'probook', label: 'ProBook' }, { value: 'zhan66', label: '战66' }] },
      { value: 'huawei', label: '华为', models: [{ value: 'matebook_x', label: 'MateBook X' }, { value: 'matebook_d', label: 'MateBook D' }] },
      { value: 'honor', label: '荣耀', models: [{ value: 'magicbook', label: 'MagicBook' }] },
      { value: 'asus', label: '华硕', models: [{ value: 'lingyao', label: '灵耀' }, { value: 'wuwei', label: '无畏' }, { value: 'tianxuan', label: '天选' }] },
      { value: 'apple', label: '苹果', models: [{ value: 'macbook_pro', label: 'MacBook Pro' }, { value: 'macbook_air', label: 'MacBook Air' }] },
      { value: 'xiaomi', label: '小米', models: [{ value: 'redmibook', label: 'RedmiBook' }] },
    ],
  },
  {
    value: 'server', label: '服务器',
    brands: [
      { value: 'inspur', label: '浪潮', models: [{ value: 'nf_series', label: '英信NF系列' }] },
      { value: 'huawei', label: '华为', models: [{ value: 'fusionserver', label: 'FusionServer' }, { value: 'taishan', label: 'Taishan' }] },
      { value: 'lenovo', label: '联想', models: [{ value: 'thinksystem_sr', label: 'ThinkSystem SR' }] },
      { value: 'dell', label: '戴尔', models: [{ value: 'poweredge_r', label: 'PowerEdge R' }, { value: 'poweredge_t', label: 'PowerEdge T' }] },
      { value: 'h3c', label: '新华三', models: [{ value: 'uniserver', label: 'H3C UniServer' }] },
      { value: 'xfusion', label: '超聚变', models: [{ value: 'xfusion_fs', label: 'FusionServer' }] },
      { value: 'sugon', label: '曙光', models: [{ value: 'sugon_series', label: '曙光系列' }] },
      { value: 'suma', label: '中科可控', models: [{ value: 'suma_series', label: '可控系列' }] },
    ],
  },
  {
    value: 'printer', label: '打印机',
    brands: [
      { value: 'hp', label: '惠普', models: [{ value: 'laserjet', label: 'LaserJet' }, { value: 'officejet', label: 'OfficeJet' }] },
      { value: 'canon', label: '佳能', models: [{ value: 'ir', label: 'iR系列' }, { value: 'lbp', label: 'LBP系列' }] },
      { value: 'brother', label: '兄弟', models: [{ value: 'dcp', label: 'DCP系列' }, { value: 'mfc', label: 'MFC系列' }] },
      { value: 'lenovo', label: '联想', models: [{ value: 'lj', label: 'LJ系列' }, { value: 'm_series', label: 'M系列' }] },
      { value: 'pantum', label: '奔图', models: [{ value: 'pantum_series', label: 'Pantum系列' }] },
      { value: 'epson', label: '爱普生', models: [{ value: 'l_series', label: 'L系列' }, { value: 'workforce', label: 'WorkForce' }] },
      { value: 'fuji_xerox', label: '富士施乐', models: [{ value: 'docuprint', label: 'DocuPrint' }] },
    ],
  },
  {
    value: 'copier', label: '复印机',
    brands: [
      { value: 'canon', label: '佳能', models: [{ value: 'imagerunner', label: 'imageRUNNER' }] },
      { value: 'ricoh', label: '理光', models: [{ value: 'mp_series', label: 'MP系列' }] },
      { value: 'fuji_xerox', label: '富士施乐', models: [{ value: 'apeosport', label: 'ApeosPort' }] },
      { value: 'konica_minolta', label: '柯尼卡美能达', models: [{ value: 'bizhub', label: 'bizhub' }] },
      { value: 'sharp', label: '夏普', models: [{ value: 'mx_series', label: 'MX系列' }] },
      { value: 'toshiba', label: '东芝', models: [{ value: 'estudio', label: 'e-STUDIO' }] },
    ],
  },
  {
    value: 'monitor', label: '显示器',
    brands: [
      { value: 'dell', label: '戴尔', models: [{ value: 'ultrasharp', label: 'Ultrasharp' }, { value: 's_series', label: 'S系列' }, { value: 'p_series', label: 'P系列' }] },
      { value: 'lenovo', label: '联想', models: [{ value: 'thinkvision', label: 'ThinkVision' }] },
      { value: 'aoc', label: 'AOC冠捷', models: [{ value: 'aoc_series', label: '冠捷系列' }] },
      { value: 'philips', label: '飞利浦', models: [{ value: 'philips_series', label: '飞利浦系列' }] },
      { value: 'samsung', label: '三星', models: [{ value: 'viewfinity', label: 'ViewFinity' }] },
      { value: 'asus', label: '华硕', models: [{ value: 'proart_display', label: 'ProArt' }, { value: 'tuf_display', label: 'TUF' }] },
      { value: 'xiaomi', label: '小米', models: [{ value: 'redmi_display', label: 'Redmi显示器' }] },
      { value: 'hkc', label: 'HKC惠科', models: [{ value: 'hkc_series', label: '惠科系列' }] },
    ],
  },
  {
    value: 'keyboard', label: '键盘',
    brands: [
      { value: 'logitech', label: '罗技', models: [{ value: 'mx_keys', label: 'MX系列' }, { value: 'k_series', label: 'K系列' }] },
      { value: 'rapoo', label: '雷柏', models: [{ value: 'v_series', label: 'V系列' }] },
      { value: 'cherry', label: '樱桃', models: [{ value: 'cherry_mx', label: 'Cherry MX' }] },
      { value: 'dareu', label: '达尔优', models: [{ value: 'dareu_series', label: '达尔优系列' }] },
      { value: 'ikbc', label: 'ikbc', models: [{ value: 'ikbc_series', label: 'ikbc系列' }] },
      { value: 'filco', label: 'Filco', models: [{ value: 'filco_series', label: 'Filco系列' }] },
      { value: 'corsair', label: '海盗船', models: [{ value: 'corsair_k', label: 'K系列' }] },
      { value: 'a4tech', label: '双飞燕', models: [{ value: 'a4tech_series', label: '双飞燕系列' }] },
    ],
  },
  {
    value: 'mouse', label: '鼠标',
    brands: [
      { value: 'logitech', label: '罗技', models: [{ value: 'mx_master', label: 'MX系列' }, { value: 'g_series', label: 'G系列' }] },
      { value: 'razer', label: '雷蛇', models: [{ value: 'deathadder', label: 'DeathAdder' }, { value: 'viper', label: 'Viper' }] },
      { value: 'rapoo', label: '雷柏', models: [{ value: 'vt_series', label: 'VT系列' }, { value: 'mt_series', label: 'MT系列' }] },
      { value: 'a4tech', label: '双飞燕', models: [{ value: 'a4tech_mouse', label: '双飞燕系列' }] },
      { value: 'dareu', label: '达尔优', models: [{ value: 'dareu_mouse', label: '达尔优系列' }] },
    ],
  },
  {
    value: 'hdd', label: '硬盘',
    brands: [
      { value: 'seagate', label: '希捷', models: [{ value: 'barracuda', label: 'BarraCuda' }, { value: 'ironwolf', label: 'IronWolf' }, { value: 'exos', label: 'Exos' }] },
      { value: 'wd', label: '西部数据', models: [{ value: 'wd_blue', label: 'Blue' }, { value: 'wd_black', label: 'Black' }, { value: 'wd_red', label: 'Red' }, { value: 'wd_gold', label: 'Gold' }, { value: 'ultrastar', label: 'Ultrastar' }] },
      { value: 'samsung', label: '三星', models: [{ value: '870_evo', label: '870 EVO' }, { value: '990_pro', label: '990 PRO' }] },
      { value: 'kioxia', label: '铠侠', models: [{ value: 'exceria', label: 'Exceria' }] },
      { value: 'zhitai', label: '致态', models: [{ value: 'tiplus', label: 'TiPlus' }] },
      { value: 'kingston', label: '金士顿', models: [{ value: 'kc_series', label: 'KC系列' }, { value: 'a_series', label: 'A系列' }] },
      { value: 'intel', label: '英特尔', models: [{ value: 'optane', label: 'Optane' }, { value: 'intel_ssd', label: 'SSD系列' }] },
    ],
  },
  {
    value: 'gpu', label: '显卡',
    brands: [
      { value: 'nvidia', label: 'NVIDIA', models: [{ value: 'rtx_40', label: 'GeForce RTX 40系' }, { value: 'quadro', label: 'Quadro' }] },
      { value: 'amd', label: 'AMD', models: [{ value: 'rx_7000', label: 'Radeon RX 7000系' }] },
      { value: 'intel', label: 'Intel', models: [{ value: 'arc', label: 'Arc' }] },
      { value: 'colorful', label: '七彩虹', models: [{ value: 'igame', label: 'iGame' }] },
      { value: 'asus', label: '华硕', models: [{ value: 'rog_strix', label: 'ROG Strix' }, { value: 'tuf_gpu', label: 'TUF' }] },
      { value: 'msi', label: '微星', models: [{ value: 'msi_gaming', label: 'Gaming' }, { value: 'msi_suprim', label: 'Suprim' }] },
      { value: 'gigabyte', label: '技嘉', models: [{ value: 'aorus', label: 'AORUS' }, { value: 'windforce', label: 'Windforce' }] },
      { value: 'galax', label: '影驰', models: [{ value: 'xingyao', label: '星曜' }, { value: 'jinshu_dashi', label: '金属大师' }] },
    ],
  },
  {
    value: 'network', label: '网络设备(路由器/交换机)',
    brands: [
      { value: 'huawei', label: '华为', models: [{ value: 'ar_ne', label: 'AR/NE路由器' }, { value: 's_ce', label: 'S/CE交换机' }] },
      { value: 'h3c', label: '新华三H3C', models: [{ value: 'er_msr', label: 'ER/MSR路由器' }, { value: 'h3c_s', label: 'S系列交换机' }] },
      { value: 'ruijie', label: '锐捷', models: [{ value: 'rg_eg_nbr', label: 'RG-EG/NBR路由器' }, { value: 'rg_s', label: 'RG-S交换机' }] },
      { value: 'tplink', label: 'TP-LINK', models: [{ value: 'tl_er', label: 'TL-ER路由器' }, { value: 'tl_sg', label: 'TL-SG交换机' }] },
      { value: 'cisco', label: '思科', models: [{ value: 'catalyst', label: 'Catalyst' }, { value: 'isr', label: 'ISR' }] },
    ],
  },
  {
    value: 'ups', label: 'UPS不间断电源',
    brands: [
      { value: 'santak', label: '山特SANTAK', models: [{ value: 'castle', label: 'Castle系列' }, { value: 'tg_series', label: 'TG系列' }] },
      { value: 'apc', label: 'APC', models: [{ value: 'back_ups', label: 'Back-UPS' }, { value: 'smart_ups', label: 'Smart-UPS' }] },
      { value: 'huawei', label: '华为', models: [{ value: 'ups5000', label: 'UPS5000系列' }] },
      { value: 'kehua', label: '科华', models: [{ value: 'kehua_series', label: '科华系列' }] },
      { value: 'emerson', label: '艾默生', models: [{ value: 'adapt_series', label: 'Adapt系列' }] },
    ],
  },
  {
    value: 'scanner', label: '扫描仪',
    brands: [
      { value: 'epson', label: '爱普生', models: [{ value: 'perfection', label: 'Perfection' }, { value: 'ds_series', label: 'DS系列' }] },
      { value: 'canon', label: '佳能', models: [{ value: 'canoscan', label: 'CanoScan' }, { value: 'dr_series', label: 'DR系列' }] },
      { value: 'fujitsu', label: '富士通', models: [{ value: 'fi_series', label: 'fi系列' }] },
      { value: 'hp', label: '惠普', models: [{ value: 'scanjet', label: 'ScanJet' }] },
      { value: 'avision', label: '虹光', models: [{ value: 'avision_series', label: 'Avision系列' }] },
    ],
  },
  {
    value: 'projector', label: '投影仪',
    brands: [
      { value: 'epson', label: '爱普生', models: [{ value: 'eb_series', label: 'EB系列' }, { value: 'cb_series', label: 'CB系列' }] },
      { value: 'benq', label: '明基', models: [{ value: 'mh_series', label: 'MH系列' }, { value: 'mx_series', label: 'MX系列' }] },
      { value: 'sony', label: '索尼', models: [{ value: 'vpl_series', label: 'VPL系列' }] },
      { value: 'xgimi', label: '极米', models: [{ value: 'h_series', label: 'H系列' }, { value: 'horizon', label: 'Horizon系列' }] },
      { value: 'jmgo', label: '坚果', models: [{ value: 'jmgo_series', label: 'JmGO系列' }] },
      { value: 'dangbei', label: '当贝', models: [{ value: 'dangbei_series', label: '当贝系列' }] },
    ],
  },
  {
    value: 'aio', label: '一体机',
    brands: [
      { value: 'lenovo', label: '联想', models: [{ value: 'qitian_aio', label: '启天AIO' }] },
      { value: 'dell', label: '戴尔', models: [{ value: 'optiplex_aio', label: 'OptiPlex AIO' }] },
      { value: 'hp', label: '惠普', models: [{ value: 'eliteone', label: 'EliteOne' }, { value: 'proone', label: 'ProOne' }] },
      { value: 'apple', label: '苹果', models: [{ value: 'imac', label: 'iMac' }] },
      { value: 'huawei', label: '华为', models: [{ value: 'mateview', label: 'MateView' }] },
    ],
  },
];

// ========== 模拟数据 ==========
const MOCK_HARDWARE = [
  { key: '1', item: 'CPU', detail: 'Intel Core i7-13700', spec: '16核24线程 / 2.1-5.2GHz', source: 'WMI' },
  { key: '2', item: '主板', detail: 'ASUS TUF GAMING B760M-PLUS', spec: 'LGA1700 / DDR5', source: 'WMI' },
  { key: '3', item: '内存', detail: 'Kingston 32GB DDR5-5600', spec: '2×16GB 双通道', source: 'WMI' },
  { key: '4', item: '硬盘', detail: 'Samsung 990 Pro 1TB NVMe', spec: 'PCIe 4.0 / 读取7450MB/s', source: 'WMI' },
  { key: '5', item: '显卡', detail: 'NVIDIA GeForce RTX 4060', spec: '8GB GDDR6 / PCIe 4.0', source: 'WMI' },
  { key: '6', item: '网卡', detail: 'Realtek 2.5GbE + Intel AX211 WiFi6E', spec: '有线/无线双网卡', source: 'WMI' },
  { key: '7', item: '显示器', detail: 'Dell U2723QE 27" 4K', spec: '3840×2160 / IPS', source: 'EDID' },
  { key: '8', item: '系统', detail: 'Windows 11 专业版 23H2', spec: '64位 / Build 22631', source: 'Win32_OperatingSystem' },
];

const MOCK_NETWORK_CHECK = [
  { key: '1', check: 'IP地址获取', status: 'ok', detail: '192.168.1.105 (DHCP)' },
  { key: '2', check: '网关可达', status: 'ok', detail: '192.168.1.1 <1ms' },
  { key: '3', check: 'DNS解析', status: 'ok', detail: '223.5.5.5 正常' },
  { key: '4', check: 'SMB服务', status: 'warn', detail: '未启用（可一键修复）' },
  { key: '5', check: 'RDP远程桌面', status: 'ok', detail: '端口3389 已监听' },
  { key: '6', check: 'WinRM', status: 'warn', detail: '未配置（可一键修复）' },
  { key: '7', check: '防火墙规则', status: 'ok', detail: '入站规则完整' },
  { key: '8', check: 'IP冲突检测', status: 'ok', detail: '未发现冲突' },
];

const MOCK_PRINTERS = [
  { key: '1', name: 'HP LaserJet Pro M404dn', type: '网络打印机', port: '192.168.1.200:9100', status: '在线', shared: false },
  { key: '2', name: 'Canon LBP2900+', type: 'USB打印机', port: 'USB001', status: '在线', shared: false },
];

const MOCK_DISK_CLEAN = [
  { key: '1', category: '临时文件', path: 'C:\\Users\\Admin\\AppData\\Local\\Temp', size: '1.2 GB', safe: true },
  { key: '2', category: 'Windows更新缓存', path: 'C:\\Windows\\SoftwareDistribution\\Download', size: '3.8 GB', safe: true },
  { key: '3', category: '回收站', path: '回收站', size: '256 MB', safe: true },
  { key: '4', category: '缩略图缓存', path: 'C:\\Users\\Admin\\AppData\\Local\\Microsoft\\Windows\\Explorer', size: '180 MB', safe: true },
  { key: '5', category: '休眠文件', path: 'C:\\hiberfil.sys', size: '6.4 GB', safe: false, note: '需确认' },
];

interface MockAsset {
  key: string;
  type: string;
  name: string;
  spec: string;
  dept: string;
  price: string;
  priceDate: string;
  source: 'system' | 'manual';
}

const MOCK_ASSETS: MockAsset[] = [
  { key: 'sys_1', type: '台式机', name: '设计师工作站', spec: 'i7-13700/RTX4060/32GB', dept: '设计部', price: '¥8,499 (京东)', priceDate: '2026-07', source: 'system' },
  { key: 'sys_2', type: '笔记本', name: 'ThinkPad X1 Carbon', spec: 'i7-1365U/16GB/512GB', dept: '管理层', price: '¥9,999 (京东)', priceDate: '2026-07', source: 'system' },
  { key: 'sys_3', type: '服务器', name: 'Ubuntu 文件服务器', spec: 'Xeon E-2288G/64GB/4TB RAID', dept: 'IT部', price: '¥6,500 (二手参考)', priceDate: '2026-07', source: 'system' },
  { key: 'sys_4', type: '打印机', name: 'HP LaserJet Pro M404dn', spec: '黑白激光/自动双面', dept: '共享设备', price: '¥2,399 (京东)', priceDate: '2026-07', source: 'system' },
];

const DEPT_OPTIONS = [
  { value: '研发部', label: '研发部' },
  { value: '设计部', label: '设计部' },
  { value: '市场部', label: '市场部' },
  { value: '销售部', label: '销售部' },
  { value: '财务部', label: '财务部' },
  { value: '人事部', label: '人事部' },
  { value: '管理层', label: '管理层' },
  { value: 'IT部', label: 'IT部' },
  { value: '共享设备', label: '共享设备' },
];

const TABS = [
  { key: 'hardware', label: '硬件扫描', icon: <ScanOutlined /> },
  { key: 'network', label: '网络体检', icon: <WifiOutlined /> },
  { key: 'printer', label: '打印机管理', icon: <PrinterOutlined /> },
  { key: 'disk', label: 'C盘清理', icon: <FileProtectOutlined /> },
  { key: 'assets', label: '资产报表', icon: <DatabaseOutlined /> },
];

export default function JinWangTongDemo() {
  const user = useAuthStore((s) => s.user);
  const nav = useNavigate();
  const [activeTab, setActiveTab] = useState<string>('hardware');
  const [scanning, setScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [buyLoading, setBuyLoading] = useState(false);
  const [payQr, setPayQr] = useState<{ open: boolean; value: string; orderNo: string } | null>(null);
  const pollRef = useRef<number | null>(null);

  // 手动登记资产状态
  const [manualAssets, setManualAssets] = useState<MockAsset[]>([]);
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [form] = Form.useForm();

  // 二级联动
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>(undefined);
  const [selectedBrand, setSelectedBrand] = useState<string | undefined>(undefined);

  const stopPolling = () => {
    if (pollRef.current !== null) { window.clearInterval(pollRef.current); pollRef.current = null; }
  };

  const startPolling = (orderNo: string) => {
    stopPolling();
    pollRef.current = window.setInterval(async () => {
      try {
        const r: any = await billingAPI.getOrderStatus(orderNo);
        if (r?.data?.status === 'paid') {
          stopPolling();
          setPayQr((prev) => prev ? { ...prev, open: false } : null);
          message.success('支付成功！License 已自动签发到您的账号，可前往个人中心下载');
        } else if (r?.data?.status === 'expired') {
          stopPolling();
          message.warning('订单已过期，请重新下单');
          setPayQr(null);
        }
      } catch { /* ignore */ }
    }, 3000);
  };

  const closePayQr = () => {
    stopPolling();
    setPayQr(null);
  };

  const handleBuy = async () => {
    if (!user) {
      Modal.confirm({ title: '请先登录', content: '购买金网通需要登录 AIbak 账号。', okText: '去登录', cancelText: '取消', onOk: () => nav('/login') });
      return;
    }
    setBuyLoading(true);
    try {
      const res: any = await billingAPI.createPrivateLicenseOrder({ packageId: 'ent-standard' });
      const payUrl = res?.data?.payParams?.code_url || res?.data?.payParams?.codeUrl || res?.data?.payUrl;
      const orderNo = res?.data?.orderNo as string;
      if (payUrl && orderNo) {
        setPayQr({ open: true, value: payUrl, orderNo });
        startPolling(orderNo);
      } else {
        message.success('已创建订单，请在订单管理中完成支付');
        nav('/profile?tab=orders');
      }
    } catch (err) { message.error(extractApiError(err, '创建订单失败，请稍后重试')); }
    finally { setBuyLoading(false); }
  };

  const openWechatService = () => {
    Modal.info({
      title: '联系客服',
      content: (
        <div style={{ textAlign: 'center' }}>
          <Paragraph>选择您方便的客服方式</Paragraph>
          <Button type="primary" icon={<WechatOutlined />} block size="large"
            onClick={() => window.open(WEWORK_KF_URL, '_blank')}
            style={{ marginBottom: 12, background: '#07c160', borderColor: '#07c160', borderRadius: 10, height: 44 }}>
            打开企业微信客服
          </Button>
          <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 8 }}>扫码添加个人微信</Paragraph>
          <img src={PERSONAL_WECHAT_QR} alt="个人微信二维码" style={{ width: 180, height: 180, borderRadius: 8, border: '1px solid #eee' }} />
          <Paragraph type="secondary" style={{ marginTop: 8, fontSize: 12 }}>服务热线：{SERVICE_PHONE}</Paragraph>
        </div>
      ),
      width: 340,
      okButtonProps: { style: { display: 'none' } },
      cancelText: '关闭',
      onCancel: () => {},
    });
  };

  const startDemoScan = () => {
    setScanning(true);
    setScanProgress(0);
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) { clearInterval(interval); setScanning(false); return 100; }
        return prev + Math.random() * 15 + 3;
      });
    }, 200);
  };

  // 合并所有资产（系统扫描 + 手动登记）
  const allAssets = [...MOCK_ASSETS, ...manualAssets];

  // 导出 UTF-8 CSV（Excel / WPS 可直接打开），避免在浏览器引入高风险表格解析依赖。
  const handleExportCsv = () => {
    const escapeCsv = (value: unknown) => {
      const text = String(value ?? '');
      return `"${text.replace(/"/g, '""')}"`;
    };
    const headers = ['序号', '来源', '资产类别', '名称', '规格配置', '归属部门', '参考价格', '日期'];
    const rows = allAssets.map((a, i) => [
      i + 1,
      a.source === 'system' ? '系统扫描' : '手动登记',
      a.type, a.name, a.spec, a.dept, a.price, a.priceDate,
    ]);
    const csv = '\uFEFF' + [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = '金网通_资产报表.csv';
    link.click();
    URL.revokeObjectURL(url);
    message.success('资产报表已导出，可使用 Excel 或 WPS 打开');
  };

  // 打开登记弹窗
  const openRegisterModal = () => {
    form.resetFields();
    setSelectedCategory(undefined);
    setSelectedBrand(undefined);
    setRegisterModalOpen(true);
  };

  // 提交手动登记
  const handleRegisterSubmit = () => {
    form.validateFields().then((values: any) => {
      const cat = ASSET_CATEGORIES.find(c => c.value === values.category);
      const brand = cat?.brands.find(b => b.value === values.brand);
      const modelLabel = values.model_custom
        ? values.model_custom
        : (brand?.models.find(m => m.value === values.model)?.label || values.model);

      const newAsset: MockAsset = {
        key: `manual_${Date.now()}`,
        type: cat?.label || values.category,
        name: (brand?.label || values.brand) + ' ' + modelLabel,
        spec: values.spec || '-',
        dept: values.dept,
        price: values.price != null ? '¥' + values.price.toLocaleString() + ' (手动登记)' : '-',
        priceDate: values.purchase_date ? values.purchase_date.format('YYYY-MM') : '-',
        source: 'manual',
      };
      setManualAssets(prev => [newAsset, ...prev]);
      message.success('资产登记成功！');
      setRegisterModalOpen(false);
      form.resetFields();
      setSelectedCategory(undefined);
      setSelectedBrand(undefined);
    });
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'hardware':
        return (
          <>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              一键采集本机 CPU、主板、内存、硬盘、显卡、网卡、显示器、BIOS 完整信息。支持 Windows/Linux/macOS，PowerShell 2.0+ 全兼容。
            </Paragraph>
            {!scanning && scanProgress === 0 && (
              <Button type="primary" icon={<PlayCircleOutlined />} onClick={startDemoScan} style={{ borderRadius: 8, marginBottom: 16 }}>
                演示扫描过程
              </Button>
            )}
            {scanning && <Progress percent={Math.min(100, Math.round(scanProgress))} status="active" style={{ marginBottom: 16 }} />}
            {scanProgress >= 100 && (
              <>
                <Tag color="success" style={{ marginBottom: 12 }}>扫描完成 · 共采集 8 项硬件信息</Tag>
                <Table dataSource={MOCK_HARDWARE} columns={[
                  { title: '硬件', dataIndex: 'item', width: 80 },
                  { title: '型号', dataIndex: 'detail' },
                  { title: '规格', dataIndex: 'spec' },
                  { title: '来源', dataIndex: 'source', width: 80, render: (s: string) => <Tag>{s}</Tag> },
                ]} size="small" pagination={false} />
              </>
            )}
            {!scanning && scanProgress === 0 && (
              <Empty description="点击「演示扫描过程」查看模拟硬件扫描结果" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            )}
          </>
        );
      case 'network':
        return (
          <>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              检测 IP 地址、网关、DNS、SMB/RDP/WinRM 服务、防火墙和 IP 冲突。发现问题可一键修复。
            </Paragraph>
            <Table dataSource={MOCK_NETWORK_CHECK} columns={[
              { title: '检测项', dataIndex: 'check', width: 120 },
              {
                title: '状态', dataIndex: 'status', width: 80,
                render: (s: string) => s === 'ok'
                  ? <Tag color="success" icon={<CheckCircleOutlined />}>正常</Tag>
                  : <Tag color="warning" icon={<ClockCircleOutlined />}>待修复</Tag>
              },
              { title: '详情', dataIndex: 'detail' },
            ]} size="small" pagination={false} />
            <div style={{ marginTop: 12, padding: 12, background: '#fffbe6', borderRadius: 8, border: '1px solid #ffe58f' }}>
              <Text strong style={{ color: '#ad6800' }}>⚠ 发现 2 项可自动修复的问题：</Text>
              <br />
              <Text style={{ color: '#ad6800' }}>· SMB服务未启用 — 运行 .\netcheck.ps1 -AutoFix 一键修复</Text>
              <br />
              <Text style={{ color: '#ad6800' }}>· WinRM未配置 — 运行 .\perms-fix.ps1 自动配置</Text>
            </div>
          </>
        );
      case 'printer':
        return (
          <>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              自动发现 USB/LPT/网络打印机，智能配置共享，支持一键打印测试页。
            </Paragraph>
            <Table dataSource={MOCK_PRINTERS} columns={[
              { title: '打印机名称', dataIndex: 'name' },
              { title: '类型', dataIndex: 'type', render: (t: string) => <Tag>{t}</Tag> },
              { title: '端口', dataIndex: 'port' },
              { title: '状态', dataIndex: 'status', render: (s: string) => <Tag color="success">{s}</Tag> },
              {
                title: '操作', dataIndex: 'shared',
                render: (shared: boolean) => shared
                  ? <Tag color="blue">已共享</Tag>
                  : <Button size="small" type="primary" ghost>一键共享</Button>
              },
            ]} size="small" pagination={false} />
            <div style={{ marginTop: 12, textAlign: 'center' }}>
              <Paragraph type="secondary" style={{ fontSize: 12 }}>点击「一键共享」后，同局域网其他电脑即可发现并使用该打印机。</Paragraph>
            </div>
          </>
        );
      case 'disk':
        return (
          <>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              扫描C盘垃圾文件（临时文件/缓存/休眠文件），按安全等级分类，仅清理系统垃圾，不碰个人文件。
            </Paragraph>
            <Table dataSource={MOCK_DISK_CLEAN} columns={[
              { title: '类别', dataIndex: 'category', width: 140 },
              { title: '路径', dataIndex: 'path', ellipsis: true },
              { title: '大小', dataIndex: 'size', width: 80, render: (s: string) => <Text strong>{s}</Text> },
              {
                title: '安全性', dataIndex: 'safe', width: 80,
                render: (s: boolean) => s ? <Tag color="success">可安全清理</Tag> : <Tag color="error">需确认</Tag>
              },
            ]} size="small" pagination={false} />
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between' }}>
              <Statistic title="可安全清理" value="5.4 GB" prefix={<FileProtectOutlined />} />
              <Statistic title="需确认后清理" value="6.4 GB" prefix={<ClockCircleOutlined />} valueStyle={{ color: '#faad14' }} />
              <Statistic title="总计可释放" value="11.8 GB" prefix={<ThunderboltOutlined />} valueStyle={{ color: '#52c41a' }} />
            </div>
          </>
        );
      case 'assets':
        return (
          <>
            <Paragraph type="secondary" style={{ marginBottom: 16 }}>
              自动汇总硬件资产，联网对比京东/中关村实时价格。支持手动登记其他 IT 资产，生成报表并导出 CSV（Excel/WPS 可直接打开）。
            </Paragraph>
            <Table dataSource={allAssets} columns={[
              {
                title: '来源', dataIndex: 'source', width: 90,
                render: (s: string) => s === 'system'
                  ? <Tag color="blue">系统扫描</Tag>
                  : <Tag color="green">手动登记</Tag>
              },
              { title: '类型', dataIndex: 'type', width: 80, render: (t: string) => <Tag>{t}</Tag> },
              { title: '名称', dataIndex: 'name' },
              { title: '规格', dataIndex: 'spec', ellipsis: true },
              { title: '归属', dataIndex: 'dept', width: 80 },
              { title: '参考价格', dataIndex: 'price', render: (p: string) => <Text strong style={{ color: '#fa541c' }}>{p}</Text> },
              { title: '日期', dataIndex: 'priceDate', width: 80 },
            ]} size="small" pagination={false} />
            <div style={{ marginTop: 12, textAlign: 'right' }}>
              <Space>
                <Button icon={<DownloadOutlined />} onClick={handleExportCsv}>导出 CSV</Button>
                <Button icon={<PlusOutlined />} type="primary" onClick={openRegisterModal}>手动登记资产</Button>
              </Space>
            </div>
          </>
        );
    }
  };

  // 当前选中类别的 brands
  const currentCategory = ASSET_CATEGORIES.find(c => c.value === selectedCategory);
  const currentBrandObj = currentCategory?.brands.find(b => b.value === selectedBrand);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '0 8px' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #1a1a2e 100%)',
        borderRadius: 16, padding: '40px 32px', textAlign: 'center', marginBottom: 24,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)', borderRadius: '50%' }} />
        <Title level={2} style={{ color: '#fff', marginBottom: 8, position: 'relative', zIndex: 1 }}>金网通 · 在线体验中心</Title>
        <Paragraph style={{ color: '#94a3b8', fontSize: 15, maxWidth: 600, margin: '0 auto 20px', position: 'relative', zIndex: 1 }}>
          以下是金网通运行后的真实效果演示（演示数据）。安装后即可对本机进行真实扫描和管理。
        </Paragraph>
        <Space size={16} style={{ position: 'relative', zIndex: 1 }}>
          <Button type="primary" size="large" icon={<PlayCircleOutlined />}
            onClick={() => { setActiveTab("hardware"); }}
            style={{ borderRadius: 10, height: 48, padding: "0 28px", fontSize: 16, fontWeight: 600,
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none",
              boxShadow: "0 4px 20px rgba(99,102,241,0.4)" }}>
            在线体验（免费演示）
          </Button>
          <Button size="large" icon={<ShoppingCartOutlined />} loading={buyLoading}
            onClick={handleBuy}
            style={{ borderRadius: 10, height: 48, padding: "0 28px", fontSize: 15, fontWeight: 600,
              background: "#fff", color: "#6366f1", border: "2px solid #6366f1" }}>
            立即购买 ¥299起
          </Button>
          <Button size="large" ghost icon={<WechatOutlined />} onClick={openWechatService}
            style={{ borderRadius: 10, height: 48, padding: '0 28px', fontSize: 15, color: '#07c160', borderColor: '#07c160' }}>
            联系客服
          </Button>
        </Space>
      </div>

      {/* Tab demo */}
      <Card styles={{ body: { padding: 16 } }} style={{ borderRadius: 14, marginBottom: 24 }}>
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={TABS.map(t => ({
          key: t.key, label: <span>{t.icon} {t.label}</span>,
        }))} />
        <div style={{ minHeight: 280 }}>{renderTab()}</div>
      </Card>

      {/* How it works */}
      <Card style={{ borderRadius: 14, marginBottom: 24 }} title="📦 如何使用">
        <Steps direction="vertical" current={-1} items={[
          { title: '在线体验（无需下载）', description: '点击上方按钮进入 Web 在线演示，无需安装' },
          { title: '在线购买并支付', description: '点击「立即购买」直接生成订单，扫码完成微信支付' },
          { title: '环境体检', description: '右键 PowerShell → 以管理员运行 .\\compat-check.ps1' },
          { title: '一键修复', description: '如有问题运行 .\\perms-fix.ps1 自动修复' },
          { title: '开始扫描', description: '运行 .\\wizard.ps1 打开交互式配置向导，选择需要的功能' },
        ]} />
      </Card>

      {/* CTA */}
      <div style={{
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        borderRadius: 16, padding: '40px 32px', textAlign: 'center', marginBottom: 24,
      }}>
        <Title level={3} style={{ color: '#fff', marginBottom: 8 }}>购买后即可下载安装包</Title>
        <Paragraph style={{ color: 'rgba(255,255,255,0.8)', fontSize: 15, marginBottom: 20 }}>
          在线体验满意后购买 · 永久买断 ¥299起 · 支付成功自动签发License · 立即下载安装包
        </Paragraph>
        <Space size={16}>
          <Button size="large" icon={<ShoppingCartOutlined />} loading={buyLoading} onClick={handleBuy}
            style={{ borderRadius: 10, height: 48, padding: '0 32px', fontSize: 15, fontWeight: 600, background: '#fff', color: '#6366f1', border: 'none' }}>
            立即购买
          </Button>
          <Button size="large" ghost onClick={() => nav('/jinwangtong')}
            style={{ borderRadius: 10, height: 48, padding: '0 32px', fontSize: 15, color: '#fff', borderColor: 'rgba(255,255,255,0.6)' }}>
            查看完整产品页
          </Button>
        </Space>
      </div>

      {/* 微信支付二维码弹窗 */}
      {payQr?.open && (
        <Modal open={payQr.open} title="微信支付 · 金网通专业版" footer={null} onCancel={closePayQr} width={360} centered>
          <div style={{ textAlign: 'center' }}>
            <Paragraph>请使用微信扫描下方二维码完成支付</Paragraph>
            <QRCodeSVG value={payQr.value} size={200} style={{ margin: '0 auto' }} />
            <Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>支付完成后 License 将自动签发到您的账号</Paragraph>
            <Paragraph type="secondary" style={{ fontSize: 12 }}>订单号：{payQr.orderNo}</Paragraph>
          </div>
        </Modal>
      )}

      {/* 手动登记资产弹窗 */}
      <Modal
        title="手动登记 IT 资产"
        open={registerModalOpen}
        onCancel={() => { setRegisterModalOpen(false); form.resetFields(); setSelectedCategory(undefined); setSelectedBrand(undefined); }}
        onOk={handleRegisterSubmit}
        okText="确认登记"
        cancelText="取消"
        width={560}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          <Form.Item
            name="category"
            label="资产类别"
            rules={[{ required: true, message: '请选择资产类别' }]}
          >
            <Select
              placeholder="请选择资产类别"
              options={ASSET_CATEGORIES.map(c => ({ value: c.value, label: c.label }))}
              onChange={(val) => {
                setSelectedCategory(val);
                setSelectedBrand(undefined);
                form.setFieldsValue({ brand: undefined, model: undefined, model_custom: undefined });
              }}
            />
          </Form.Item>

          <Form.Item
            name="brand"
            label="品牌"
            rules={[{ required: true, message: '请选择品牌' }]}
          >
            <Select
              placeholder={selectedCategory ? '请选择品牌' : '请先选择资产类别'}
              disabled={!selectedCategory}
              options={currentCategory?.brands.map(b => ({ value: b.value, label: b.label })) || []}
              onChange={(val) => {
                setSelectedBrand(val);
                form.setFieldsValue({ model: undefined, model_custom: undefined });
              }}
            />
          </Form.Item>

          <Form.Item
            label="型号名称"
            style={{ marginBottom: 0 }}
          >
            <Form.Item
              name="model"
              style={{ display: 'inline-block', width: 'calc(50% - 8px)', marginBottom: 16 }}
            >
              <Select
                placeholder={selectedBrand ? '选择型号（可选）' : '请先选择品牌'}
                disabled={!selectedBrand}
                options={currentBrandObj?.models.map(m => ({ value: m.value, label: m.label })) || []}
                allowClear
              />
            </Form.Item>
            <Form.Item
              name="model_custom"
              style={{ display: 'inline-block', width: 'calc(50% - 8px)', marginLeft: 16, marginBottom: 16 }}
            >
              <Input placeholder="或自由输入型号" />
            </Form.Item>
          </Form.Item>

          <Form.Item
            name="spec"
            label="规格配置"
          >
            <Input placeholder="如 i7-13700/RTX4060/32GB" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="qty"
                label="数量"
                initialValue={1}
              >
                <InputNumber min={1} max={9999} style={{ width: '100%' }} placeholder="1" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="dept"
                label="归属部门"
                rules={[{ required: true, message: '请选择归属部门' }]}
              >
                <Select placeholder="请选择部门" options={DEPT_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="purchase_date"
                label="购买日期"
              >
                <DatePicker style={{ width: '100%' }} placeholder="选择日期" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="price"
                label="购买价格(¥)"
              >
                <InputNumber min={0} max={99999999} precision={2} style={{ width: '100%' }} placeholder="0.00" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="remark"
            label="备注"
          >
            <Input.TextArea rows={3} placeholder="选填备注信息" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
