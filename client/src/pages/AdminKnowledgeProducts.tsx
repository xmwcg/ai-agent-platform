/**
 * 后台管理 — 知识产品管理页面
 * 路由：/admin/knowledge-products
 * 权限：requireAdmin（仅管理员可访问）
 *
 * 功能：
 * 1. 浏览 Obsidian 知识库目录树
 * 2. 从知识库导入/发布知识产品到商城
 * 3. 管理已发布产品（编辑/上架/下架/删除）
 */

import React, { useState, useEffect } from "react";
import {
  Card, Button, message, Typography, Space, Table, Tag, Modal,
  InputNumber, Select, Input, Popconfirm, Descriptions, Row, Col,
  Tree, Badge, Divider, Spin, Alert, Tabs,
} from "antd";
import {
  ImportOutlined, CloudUploadOutlined, DeleteOutlined, EditOutlined,
  EyeOutlined, EyeInvisibleOutlined, FolderOutlined, ReloadOutlined,
  ShoppingOutlined, BookOutlined, DatabaseOutlined,
} from "@ant-design/icons";
import { apiClient, extractApiError } from "@/services/api";

const { Title, Paragraph, Text } = Typography;

// ─── 类型 ──────────────────────────────────
interface VaultDir {
  name: string;
  path: string;
  count: number;
}

interface KnowledgeProduct {
  freePreviewPages?: number;
  _id: string;
  title: string;
  summary?: string;
  tags: string[];
  categories: string[];
  requiredPlan: string;
  creditsCost?: number;
  price?: number;
  isPublic: boolean;
  viewCount: number;
  likeCount: number;
  updatedAt: string;
}

interface PublishResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  details: Array<{
    file: string;
    status: string;
    docId?: string;
    title?: string;
    error?: string;
  }>;
}

// ─── 组件 ──────────────────────────────────
const AdminKnowledgeProducts: React.FC = () => {
  const [vaultTree, setVaultTree] = useState<VaultDir[]>([]);
  const [vaultPath, setVaultPath] = useState("");
  const [selectedDir, setSelectedDir] = useState("");
  const [products, setProducts] = useState<KnowledgeProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [publishResult, setPublishResult] = useState<PublishResult | null>(null);

  // 导入选项
  const [importPrice, setImportPrice] = useState<number | undefined>(undefined);
  const [importPlan, setImportPlan] = useState<string>("");
  const [importCredits, setImportCredits] = useState<number | undefined>(undefined);
  const [importPreview, setImportPreview] = useState<number | undefined>(undefined);

  // 编辑弹窗
  const [editModal, setEditModal] = useState(false);
  const [editProduct, setEditProduct] = useState<KnowledgeProduct | null>(null);

  useEffect(() => {
    loadVaultTree();
    loadProducts();
  }, []);

  // ─── API 调用 ──────────────────────────────
  const loadVaultTree = async () => {
    try {
      const res: any = await apiClient.get("/admin/knowledge-products/vault-tree");
      setVaultTree(res.data.tree);
      setVaultPath(res.data.vaultPath);
    } catch (e) {
      message.error(extractApiError(e, "加载知识库目录失败"));
    }
  };

  const loadProducts = async (p = 1) => {
    setLoading(true);
    try {
      const res: any = await apiClient.get("/admin/knowledge-products", {
        params: { page: p, limit: 20 },
      });
      setProducts(res.data.docs);
      setTotal(res.data.total);
      setPage(p);
    } catch (e) {
      message.error(extractApiError(e, "加载产品列表失败"));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!selectedDir) {
      message.warning("请选择要导入的知识库目录");
      return;
    }
    setImporting(true);
    try {
      const res: any = await apiClient.post("/admin/knowledge-products/import-from-vault", {
        subDir: selectedDir,
        price: importPrice,
        requiredPlan: importPlan || undefined,
        creditsCost: importCredits,
        freePreviewPages: importPreview,
        isPublic: true,
        tags: ["知识库导入", "金奕鸣"],
      });
      setPublishResult(res.data);
      if (res.success) {
        message.success(`导入完成！新建 ${res.data.created} 个，更新 ${res.data.updated} 个`);
      }
      loadProducts();
    } catch (e) {
      message.error(extractApiError(e, "导入失败"));
    } finally {
      setImporting(false);
    }
  };

  const handleToggleVisibility = async (id: string) => {
    try {
      const res: any = await apiClient.patch(`/admin/knowledge-products/${id}/toggle-visibility`);
      if (res.success) {
        message.success(res.data.message);
        loadProducts(page);
      }
    } catch (e) {
      message.error(extractApiError(e, "操作失败"));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/admin/knowledge-products/${id}`);
      message.success("已删除");
      loadProducts(page);
    } catch (e) {
      message.error(extractApiError(e, "删除失败"));
    }
  };

  const handleEdit = (product: KnowledgeProduct) => {
    setEditProduct({ ...product });
    setEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editProduct) return;
    try {
      await apiClient.put(`/admin/knowledge-products/${editProduct._id}`, {
        title: editProduct.title,
        summary: editProduct.summary,
        tags: editProduct.tags,
        categories: editProduct.categories,
        price: editProduct.price,
        requiredPlan: editProduct.requiredPlan,
        creditsCost: editProduct.creditsCost,
        freePreviewPages: editProduct.freePreviewPages,
        isPublic: editProduct.isPublic,
      });
      message.success("保存成功");
      setEditModal(false);
      loadProducts(page);
    } catch (e) {
      message.error(extractApiError(e, "保存失败"));
    }
  };

  // ─── 表格列 ─────────────────────────────────
  const columns = [
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      render: (text: string, record: KnowledgeProduct) => (
        <Space>
          {record.isPublic ? (
            <EyeOutlined style={{ color: "#52c41a" }} />
          ) : (
            <EyeInvisibleOutlined style={{ color: "#faad14" }} />
          )}
          <Text strong>{text}</Text>
        </Space>
      ),
    },
    {
      title: "分类",
      dataIndex: "categories",
      key: "categories",
      width: 120,
      render: (cats: string[]) => (
        <Space size={4} wrap>
          {cats.map((c) => (
            <Tag key={c} color="blue">{c}</Tag>
          ))}
        </Space>
      ),
    },
    {
      title: "套餐",
      dataIndex: "requiredPlan",
      key: "requiredPlan",
      width: 80,
      render: (plan: string) => {
        const map: Record<string, { color: string; label: string }> = {
          free: { color: "default", label: "免费" },
          pro: { color: "blue", label: "Pro" },
          max: { color: "gold", label: "旗舰" },
        };
        const info = map[plan] || { color: "default", label: plan };
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: "价格",
      dataIndex: "price",
      key: "price",
      width: 80,
      render: (p: number) => (p ? `¥${p}` : <Text type="secondary">免费</Text>),
    },
    {
      title: "积分",
      dataIndex: "creditsCost",
      key: "creditsCost",
      width: 60,
      render: (c: number) => (c ? `${c} 分` : "-"),
    },
    {
      title: "浏览",
      dataIndex: "viewCount",
      key: "viewCount",
      width: 70,
    },
    {
      title: "更新时间",
      dataIndex: "updatedAt",
      key: "updatedAt",
      width: 120,
      render: (d: string) => new Date(d).toLocaleDateString("zh-CN"),
    },
    {
      title: "操作",
      key: "actions",
      width: 200,
      render: (_: any, record: KnowledgeProduct) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button
            size="small"
            icon={record.isPublic ? <EyeInvisibleOutlined /> : <EyeOutlined />}
            onClick={() => handleToggleVisibility(record._id)}
          >
            {record.isPublic ? "下架" : "上架"}
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record._id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // ─── 渲染 ───────────────────────────────────
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
      <Title level={2}>
        <DatabaseOutlined /> 知识产品管理
      </Title>
      <Paragraph type="secondary">
        从 Obsidian 知识库导入知识条目，发布到 aibak.site 商城售卖。知识库路径：{vaultPath}
      </Paragraph>

      <Tabs
        defaultActiveKey="products"
        items={[
          {
            key: "import",
            label: (
              <span><ImportOutlined /> 从知识库导入</span>
            ),
            children: (
              <Row gutter={24}>
                {/* 左侧：目录树 */}
                <Col span={10}>
                  <Card title={<><FolderOutlined /> Obsidian 知识库目录</>} size="small">
                    {vaultTree.length === 0 ? (
                      <Alert message="未发现知识库内容" type="info" showIcon />
                    ) : (
                      <div style={{ maxHeight: 400, overflow: "auto" }}>
                        {vaultTree.map((dir) => (
                          <div
                            key={dir.path}
                            onClick={() => setSelectedDir(dir.path)}
                            style={{
                              padding: "8px 12px",
                              cursor: "pointer",
                              borderRadius: 6,
                              marginBottom: 4,
                              background: selectedDir === dir.path ? "#e6f4ff" : "transparent",
                              border: selectedDir === dir.path ? "1px solid #1677ff" : "1px solid transparent",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <Space>
                              <FolderOutlined />
                              <Text>{dir.name}</Text>
                            </Space>
                            <Badge count={dir.count} overflowCount={999} style={{ backgroundColor: "#1677ff" }} />
                          </div>
                        ))}
                      </div>
                    )}
                    <Divider />
                    <Button icon={<ReloadOutlined />} onClick={loadVaultTree} size="small">
                      刷新目录
                    </Button>
                  </Card>
                </Col>

                {/* 右侧：导入选项 */}
                <Col span={14}>
                  <Card title="导入设置" size="small">
                    <Descriptions column={1} size="small">
                      <Descriptions.Item label="选中目录">
                        {selectedDir ? <Tag color="blue">{selectedDir}</Tag> : <Text type="secondary">请从左侧选择</Text>}
                      </Descriptions.Item>
                    </Descriptions>
                    <Divider />
                    <Space direction="vertical" style={{ width: "100%" }}>
                      <Space>
                        <Text>覆盖价格：</Text>
                        <InputNumber
                          min={0}
                          placeholder="留空使用原文元数据"
                          value={importPrice}
                          onChange={(v) => setImportPrice(v || undefined)}
                          addonAfter="元"
                          style={{ width: 180 }}
                        />
                      </Space>
                      <Space>
                        <Text>覆盖套餐：</Text>
                        <Select
                          placeholder="留空使用原文元数据"
                          allowClear
                          value={importPlan || undefined}
                          onChange={(v) => setImportPlan(v || "")}
                          style={{ width: 180 }}
                          options={[
                            { value: "free", label: "免费" },
                            { value: "pro", label: "专业版" },
                            { value: "max", label: "旗舰版" },
                          ]}
                        />
                      </Space>
                      <Space>
                        <Text>覆盖积分：</Text>
                        <InputNumber
                          min={0}
                          placeholder="留空使用原文元数据"
                          value={importCredits}
                          onChange={(v) => setImportCredits(v || undefined)}
                          addonAfter="分"
                          style={{ width: 180 }}
                        />
                      </Space>
                      <Space>
                        <Text>免费预览：</Text>
                        <InputNumber
                          min={0}
                          placeholder="留空使用原文元数据"
                          value={importPreview}
                          onChange={(v) => setImportPreview(v || undefined)}
                          addonAfter="页"
                          style={{ width: 180 }}
                        />
                      </Space>
                    </Space>
                    <Divider />
                    <Button
                      type="primary"
                      icon={<CloudUploadOutlined />}
                      loading={importing}
                      onClick={handleImport}
                      size="large"
                      block
                      disabled={!selectedDir}
                    >
                      从知识库导入并发布
                    </Button>

                    {/* 导入结果 */}
                    {publishResult && (
                      <>
                        <Divider />
                        <Alert
                          type={publishResult.success ? "success" : "warning"}
                          message={
                            <span>
                              导入完成：新建 <Tag color="green">{publishResult.created}</Tag>
                              更新 <Tag color="blue">{publishResult.updated}</Tag>
                              跳过 <Tag>{publishResult.skipped}</Tag>
                              {publishResult.errors.length > 0 && (
                                <> 错误 <Tag color="red">{publishResult.errors.length}</Tag></>
                              )}
                            </span>
                          }
                          showIcon
                        />
                        {publishResult.errors.length > 0 && (
                          <div style={{ maxHeight: 150, overflow: "auto", marginTop: 8 }}>
                            {publishResult.errors.map((e, i) => (
                              <Text key={i} type="danger" style={{ display: "block", fontSize: 12 }}>
                                {e}
                              </Text>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </Card>
                </Col>
              </Row>
            ),
          },
          {
            key: "products",
            label: (
              <span><ShoppingOutlined /> 已发布产品 ({total})</span>
            ),
            children: (
              <Card>
                <Table
                  columns={columns}
                  dataSource={products}
                  rowKey="_id"
                  loading={loading}
                  pagination={{
                    current: page,
                    total,
                    pageSize: 20,
                    onChange: (p) => loadProducts(p),
                    showTotal: (t: number) => `共 ${t} 个产品`,
                  }}
                  size="middle"
                />
              </Card>
            ),
          },
        ]}
      />

      {/* 编辑弹窗 */}
      <Modal
        title="编辑知识产品"
        open={editModal}
        onOk={handleSaveEdit}
        onCancel={() => setEditModal(false)}
        width={600}
      >
        {editProduct && (
          <Space direction="vertical" style={{ width: "100%" }} size="middle">
            <div>
              <Text strong>标题</Text>
              <Input
                value={editProduct.title}
                onChange={(e) => setEditProduct({ ...editProduct, title: e.target.value })}
              />
            </div>
            <div>
              <Text strong>摘要</Text>
              <Input.TextArea
                rows={3}
                value={editProduct.summary}
                onChange={(e) => setEditProduct({ ...editProduct, summary: e.target.value })}
              />
            </div>
            <Row gutter={16}>
              <Col span={12}>
                <Text strong>价格（元）</Text>
                <InputNumber
                  min={0}
                  value={editProduct.price}
                  onChange={(v) => setEditProduct({ ...editProduct, price: v || undefined })}
                  style={{ width: "100%" }}
                />
              </Col>
              <Col span={12}>
                <Text strong>套餐要求</Text>
                <Select
                  value={editProduct.requiredPlan}
                  onChange={(v) => setEditProduct({ ...editProduct, requiredPlan: v })}
                  style={{ width: "100%" }}
                  options={[
                    { value: "free", label: "免费" },
                    { value: "pro", label: "专业版" },
                    { value: "max", label: "旗舰版" },
                  ]}
                />
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Text strong>积分消耗</Text>
                <InputNumber
                  min={0}
                  value={editProduct.creditsCost}
                  onChange={(v) => setEditProduct({ ...editProduct, creditsCost: v || undefined })}
                  style={{ width: "100%" }}
                />
              </Col>
              <Col span={12}>
                <Text strong>免费预览页数</Text>
                <InputNumber
                  min={0}
                  value={editProduct.freePreviewPages}
                  onChange={(v) => setEditProduct({ ...editProduct, freePreviewPages: v || undefined })}
                  style={{ width: "100%" }}
                />
              </Col>
            </Row>
            <div>
              <Text strong>标签（逗号分隔）</Text>
              <Input
                value={editProduct.tags?.join(", ")}
                onChange={(e) =>
                  setEditProduct({
                    ...editProduct,
                    tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean),
                  })
                }
              />
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default AdminKnowledgeProducts;

