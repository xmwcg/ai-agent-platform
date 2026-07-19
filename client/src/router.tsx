import { createBrowserRouter } from "react-router-dom";
import App from "./App";
import KnowledgeList from "@/pages/KnowledgeList";
import KnowledgeDetail from "@/pages/KnowledgeDetail";
import AiChat from "@/pages/AiChat";
import Home from "@/pages/Home";
import CourseList from "@/pages/CourseList";
import CreativeWorkshop from "@/pages/CreativeWorkshop";
import ModelCalendar from "@/pages/ModelCalendar";
import ComparePage from "@/pages/ComparePage";
import Text2ImgPage from "@/pages/Text2ImgPage";
import LearningPath from "@/pages/LearningPath";
import PluginManager from "@/pages/PluginManager";
import PricingPage from "@/pages/PricingPage";
import QuizPage from "@/pages/QuizPage";
import CourseDetail from "@/pages/CourseDetail";
import KnowledgeEditorPage from "@/pages/KnowledgeEditorPage";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import CodeExplanation from "@/pages/CodeExplanation";
import ProfilePage from "@/pages/ProfilePage";
import ModelConfigPage from "@/pages/ModelConfigPage";
import CustomerServicePage from "@/pages/CustomerServicePage";
import AuditLogPage from "@/pages/AuditLogPage";
import ToolsCenterPage from "@/pages/ToolsCenterPage";
import QuickstartPage from "@/pages/QuickstartPage";
import DiagnosticsPage from "@/pages/DiagnosticsPage";
import AdminDashboardPage from "@/pages/AdminDashboardPage";
import UserAdminPage from "@/pages/UserAdminPage";
import TeamPage from "@/pages/TeamPage";
import MarketplacePage from "@/pages/MarketplacePage";
import SkillsMarketPage from "@/pages/SkillsMarketPage";
import WorkflowEditor from "@/pages/WorkflowEditor";
import KnowledgeGraphPage from "@/pages/KnowledgeGraphPage";
import SandboxPage from "@/pages/SandboxPage";
import XiaohongshuGenerator from "@/pages/XiaohongshuGenerator";
import VideoWorkflow from "@/pages/VideoWorkflow";
import TermsPage from "@/pages/TermsPage";
import PrivacyPage from "@/pages/PrivacyPage";
import RefundPolicyPage from "@/pages/RefundPolicyPage";
import PointsRulesPage from "@/pages/PointsRulesPage";
import PointsCenter from "@/pages/PointsCenter";
import DistributionPage from "@/pages/DistributionPage";
import OrderDetailPage from "@/pages/OrderDetailPage";
import AibakChat from "@/pages/AibakChat";
import PublicMetricsPage from "@/pages/PublicMetricsPage";
import AboutPage from "@/pages/AboutPage";
import ContactPage from "@/pages/ContactPage";
import JoinPage from "@/pages/JoinPage";
import CookiesPage from "@/pages/CookiesPage";
import JinWangTongPage from '@/pages/JinWangTongPage';
import RelayAdminPage from "@/pages/RelayAdminPage";
import QueryCenterPage from "@/pages/QueryCenterPage";

const router = createBrowserRouter([
  {
    path: "/login",
    element: <Login />
  },
  {
    path: "/register",
    element: <Register />
  },
  {
    path: "/",
    element: <App />,
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
      { path: "code", element: <CodeExplanation /> },
      { path: "profile", element: <ProfilePage /> },
      { path: "model-config", element: <ModelConfigPage /> },
      { path: "query-center", element: <QueryCenterPage /> },
      { path: "customer-service", element: <CustomerServicePage /> },
      { path: "customer-service/:id/audit", element: <AuditLogPage /> },
      { path: "tools", element: <ToolsCenterPage /> },
      { path: "quickstart", element: <QuickstartPage /> },
      { path: "team", element: <TeamPage /> },
      { path: "marketplace", element: <MarketplacePage /> },
      { path: "skills", element: <SkillsMarketPage /> },
      { path: "diagnostics", element: <DiagnosticsPage /> },
      { path: "ops-dashboard", element: <AdminDashboardPage /> },
      { path: "admin/users", element: <UserAdminPage /> },
      { path: "ai-chat", element: <AiChat /> },
      { path: "aibak-chat", element: <AibakChat /> },
      { path: "workflows", element: <WorkflowEditor /> },
      { path: "workflow/:id", element: <WorkflowEditor /> },
      { path: "knowledge-graph", element: <KnowledgeGraphPage /> },
      { path: "sandbox", element: <SandboxPage /> },
      { path: "xhs", element: <XiaohongshuGenerator /> },
      // Legal pages
      { path: "terms", element: <TermsPage /> },
      { path: "privacy", element: <PrivacyPage /> },
      { path: "refund-policy", element: <RefundPolicyPage /> },
      { path: "points-rules", element: <PointsRulesPage /> },
      { path: "cookies", element: <CookiesPage /> },
      // Other pages
      { path: "points-center", element: <PointsCenter /> },
      { path: "distribution", element: <DistributionPage /> },
      { path: "orders/:orderNo", element: <OrderDetailPage /> },
      { path: "about", element: <AboutPage /> },
      { path: "contact", element: <ContactPage /> },
      { path: "partners", element: <JoinPage /> },
      { path: "relay-admin", element: <RelayAdminPage /> },
      { path: "metrics", element: <PublicMetricsPage /> },
      { path: "*", element: <div>404 - 页面未找到</div> }
    ]
  }
]);

export default router;
