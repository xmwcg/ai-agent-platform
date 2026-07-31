import React, { Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
import { Spin } from "antd";
import App from "./App";

// 首屏静态导入
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Register from "@/pages/Register";

// 全部页面静态导入 — 打包进主文件，绕过 nginx MIME 问题
import KnowledgeList from "@/pages/KnowledgeList";
import KnowledgeDetail from "@/pages/KnowledgeDetail";
import KnowledgeEditorPage from "@/pages/KnowledgeEditorPage";
import AiChat from "@/pages/AiChat";
import AibakChat from "@/pages/AibakChat";
import CourseList from "@/pages/CourseList";
import CourseDetail from "@/pages/CourseDetail";
import QuizPage from "@/pages/QuizPage";
import CreativeWorkshop from "@/pages/CreativeWorkshop";
import Text2ImgPage from "@/pages/Text2ImgPage";
import VideoWorkflow from "@/pages/VideoWorkflow";
import WorkflowEditor from "@/pages/WorkflowEditor";
import CodeLabPage from "@/pages/CodeLabPage";
import XiaohongshuGenerator from "@/pages/XiaohongshuGenerator";
import StudioPage from "@/pages/StudioPage";
import ModelCalendar from "@/pages/ModelCalendar";
import ComparePage from "@/pages/ComparePage";
import LearningPath from "@/pages/LearningPath";
import PluginManager from "@/pages/PluginManager";
import PricingPage from "@/pages/PricingPage";
import ProfilePage from "@/pages/ProfilePage";
import ModelConfigPage from "@/pages/ModelConfigPage";
import QueryCenterPage from "@/pages/QueryCenterPage";
import CustomerServicePage from "@/pages/CustomerServicePage";
import AuditLogPage from "@/pages/AuditLogPage";
import ToolsCenterPage from "@/pages/ToolsCenterPage";
import QuickstartPage from "@/pages/QuickstartPage";
import DiagnosticsPage from "@/pages/DiagnosticsPage";
import SandboxPage from "@/pages/SandboxPage";
import TranSyncPage from "@/pages/TranSyncPage";
import FlowPage from "@/pages/FlowPage/FlowPage";
import MyDashboardPage from "@/pages/MyDashboardPage";
import ReferralPage from "@/pages/ReferralPage";
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import PlatformOpsMonitorPage from "@/pages/PlatformOpsMonitorPage";
import PlatformStatusPage from "@/pages/PlatformStatusPage";
import DashboardPage from "@/pages/DashboardPage";
import UserAdminPage from "@/pages/UserAdminPage";
import TeamPage from "@/pages/TeamPage";
import RelayAdminPage from "@/pages/RelayAdminPage";
import AdminKnowledgeProducts from "@/pages/AdminKnowledgeProducts";
import MarketplacePage from "@/pages/MarketplacePage";
import SkillsMarketPage from "@/pages/SkillsMarketPage";
import DeveloperPortal from "@/pages/DeveloperPortal/DeveloperPortal";
import KnowledgeGraphPage from "@/pages/KnowledgeGraphPage";
import ProjectGradeLanding from "@/pages/ProjectGrade";
import ProjectGradePublicReport from "@/pages/ProjectGrade/PublicReport";
import ProjectGradeProjects from "@/pages/ProjectGrade/Projects";
import ProjectGradeAdmin from "@/pages/ProjectGrade/Admin";
import ProjectGradeDemo from "@/pages/ProjectGrade/Demo";
import LandingSaaS from "@/pages/LandingSaaS";
import LandingEcommerce from "@/pages/LandingEcommerce";
import LandingFintech from "@/pages/LandingFintech";
import LandingHealthcare from "@/pages/LandingHealthcare";
import LandingEducation from "@/pages/LandingEducation";
import LandingInternet from "@/pages/LandingInternet";
import LandingIndustry from "@/pages/LandingIndustry";
import LandingEnterprise from "@/pages/LandingEnterprise";
import LandingGovernment from "@/pages/LandingGovernment";
import LandingMedia from "@/pages/LandingMedia";
import LandingProfessional from "@/pages/LandingProfessional";
import LandingOpensource from "@/pages/LandingOpensource";
import TermsPage from "@/pages/TermsPage";
import PrivacyPage from "@/pages/PrivacyPage";
import RefundPolicyPage from "@/pages/RefundPolicyPage";
import RefundRequestPage from "@/pages/RefundRequestPage";
import PointsRulesPage from "@/pages/PointsRulesPage";
import CookiesPage from "@/pages/CookiesPage";
import PointsCenter from "@/pages/PointsCenter";
import DistributionPage from "@/pages/DistributionPage";
import OrderDetailPage from "@/pages/OrderDetailPage";
import AboutPage from "@/pages/AboutPage";
import ContactPage from "@/pages/ContactPage";
import JoinPage from "@/pages/JoinPage";
import PublicMetricsPage from "@/pages/PublicMetricsPage";
import JinWangTongPage from "@/pages/JinWangTongPage";
import JinWangTongDashboard from "@/pages/JinWangTongDashboard";
import GuardLanding from "@/pages/GuardLanding";
import JinWangTongDemo from "@/pages/JinWangTongDemo";
import ShopPage from "@/pages/ShopPage";

const PageFallback = (
  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
    <Spin size="large" />
  </div>
);

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  { path: "/register", element: <Register /> },
  {
    path: "/",
    element: <Suspense fallback={PageFallback}><App /></Suspense>,
    children: [
      { index: true, element: <Home /> },
      { path: "knowledge", element: <KnowledgeList /> },
      { path: "knowledge/create", element: <KnowledgeEditorPage /> },
      { path: "knowledge/:id", element: <KnowledgeDetail /> },
      { path: "knowledge/:id/edit", element: <KnowledgeEditorPage /> },
      { path: "courses", element: <CourseList /> },
      { path: "courses/:id", element: <CourseDetail /> },
      { path: "courses/:courseId/quiz/:chapterIdx", element: <QuizPage /> },
      { path: "calendar", element: <ModelCalendar /> },
      { path: "compare", element: <ComparePage /> },
      { path: "learning-path", element: <LearningPath /> },
      { path: "plugins", element: <PluginManager /> },
      { path: "pricing", element: <PricingPage /> },
      { path: "creative", element: <CreativeWorkshop /> },
      { path: "video-workflow", element: <VideoWorkflow /> },
      { path: "text2img", element: <Text2ImgPage /> },
      { path: "code", element: <CodeLabPage /> },
      { path: "lab", element: <CodeLabPage /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "model-config", element: <ModelConfigPage /> },
      { path: "query-center", element: <QueryCenterPage /> },
      { path: "customer-service", element: <CustomerServicePage /> },
      { path: "customer-service/:id/audit", element: <AuditLogPage /> },
      { path: "tools", element: <ToolsCenterPage /> },
      { path: "transync", element: <TranSyncPage /> },
      { path: "flow", element: <FlowPage /> },
      { path: "quickstart", element: <QuickstartPage /> },
      { path: "diagnostics", element: <DiagnosticsPage /> },
      { path: "sandbox", element: <SandboxPage /> },
      { path: "team", element: <TeamPage /> },
      { path: "my-dashboard", element: <MyDashboardPage /> },
      { path: "referral", element: <ReferralPage /> },
      { path: "ops-dashboard", element: <AdminDashboardPage /> },
      { path: "ops-monitor", element: <PlatformOpsMonitorPage /> },
      { path: "platform-status", element: <PlatformStatusPage /> },
      { path: "admin/users", element: <UserAdminPage /> },
      { path: "admin/knowledge-products", element: <AdminKnowledgeProducts /> },
      { path: "relay-admin", element: <RelayAdminPage /> },
      { path: "marketplace", element: <MarketplacePage /> },
      { path: "developer", element: <DeveloperPortal /> },
      { path: "skills", element: <SkillsMarketPage /> },
      { path: "project-grade", element: <ProjectGradeLanding /> },
      { path: "project-grade/demo", element: <ProjectGradeDemo /> },
      { path: "project-grade/projects", element: <ProjectGradeProjects /> },
      { path: "project-grade/admin", element: <ProjectGradeAdmin /> },
      { path: "project-grade/reports/:publicId", element: <ProjectGradePublicReport /> },
      { path: "ai-chat", element: <AiChat /> },
      { path: "aibak-chat", element: <AibakChat /> },
      { path: "workflows", element: <WorkflowEditor /> },
      { path: "workflow/:id", element: <WorkflowEditor /> },
      { path: "knowledge-graph", element: <KnowledgeGraphPage /> },
      { path: "xhs", element: <XiaohongshuGenerator /> },
      { path: "studio", element: <StudioPage /> },
      { path: "terms", element: <TermsPage /> },
      { path: "privacy", element: <PrivacyPage /> },
      { path: "refund-policy", element: <RefundPolicyPage /> },
      { path: "refund-request", element: <RefundRequestPage /> },
      { path: "points-rules", element: <PointsRulesPage /> },
      { path: "cookies", element: <CookiesPage /> },
      { path: "points-center", element: <PointsCenter /> },
      { path: "distribution", element: <DistributionPage /> },
      { path: "orders/:orderNo", element: <OrderDetailPage /> },
      { path: "about", element: <AboutPage /> },
      { path: "contact", element: <ContactPage /> },
      { path: "partners", element: <JoinPage /> },
      { path: "guard", element: <GuardLanding /> },
      { path: "jinwangtong-demo", element: <JinWangTongDemo /> },
      { path: "jinwangtong", element: <JinWangTongPage /> },
      { path: "jinwangtong/dashboard", element: <JinWangTongDashboard /> },
      { path: "metrics", element: <PublicMetricsPage /> },
      { path: "landing/saas", element: <LandingSaaS /> },
      { path: "landing/ecommerce", element: <LandingEcommerce /> },
      { path: "landing/fintech", element: <LandingFintech /> },
      { path: "landing/healthcare", element: <LandingHealthcare /> },
      { path: "landing/education", element: <LandingEducation /> },
      { path: "landing/internet", element: <LandingInternet /> },
      { path: "landing/industry", element: <LandingIndustry /> },
      { path: "landing/enterprise", element: <LandingEnterprise /> },
      { path: "landing/government", element: <LandingGovernment /> },
      { path: "landing/media", element: <LandingMedia /> },
      { path: "landing/professional", element: <LandingProfessional /> },
      { path: "landing/opensource", element: <LandingOpensource /> },
      { path: "shop", element: <ShopPage /> },
            { path: "*", element: <div>404 - 页面未找到</div> },
    ],
  },
]);

export default router;
