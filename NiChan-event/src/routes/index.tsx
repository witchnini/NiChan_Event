import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/layouts/AdminLayout";
import OrganizerLayout from "@/layouts/OrganizerLayout";
import About from "@/pages/About";
import Blog from "@/pages/Blog";
import BlogDetail from "@/pages/BlogDetail";
import Contact from "@/pages/Contact";
import ForgotPassword from "@/pages/ForgotPassword";
import Index from "@/pages/Index";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import Portfolio from "@/pages/Portfolio";
import PortfolioDetail from "@/pages/PortfolioDetail";
import Register from "@/pages/Register";
import ServiceDetail from "@/pages/ServiceDetail";
import Services from "@/pages/Services";
import AdminContent from "@/pages/admin/AdminContent";
import AdminContracts from "@/pages/admin/AdminContracts";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminFinance from "@/pages/admin/AdminFinance";
import AdminNotifications from "@/pages/admin/AdminNotifications";
import AdminProfile from "@/pages/admin/AdminProfile";
import AdminProjects from "@/pages/admin/AdminProjects";
import AdminReports from "@/pages/admin/AdminReports";
import AdminRequests from "@/pages/admin/AdminRequests";
import AdminStaff from "@/pages/admin/AdminStaff";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminVendors from "@/pages/admin/AdminVendors";
import ContractView from "@/pages/customer/ContractView";
import CustomerDashboard from "@/pages/customer/CustomerDashboard";
import CustomerProfile from "@/pages/customer/CustomerProfile";
import EventTracking from "@/pages/customer/EventTracking";
import MyContracts from "@/pages/customer/MyContracts";
import MyEvents from "@/pages/customer/MyEvents";
import ReviewRating from "@/pages/customer/ReviewRating";
import OrganizerBudget from "@/pages/organizer/OrganizerBudget";
import OrganizerCommunication from "@/pages/organizer/OrganizerCommunication";
import OrganizerDashboard from "@/pages/organizer/OrganizerDashboard";
import OrganizerNotifications from "@/pages/organizer/OrganizerNotifications";
import OrganizerProfile from "@/pages/organizer/OrganizerProfile";
import OrganizerProjects from "@/pages/organizer/OrganizerProjects";
import OrganizerReports from "@/pages/organizer/OrganizerReports";
import OrganizerVendors from "@/pages/organizer/OrganizerVendors";

const PublicLayout = ({ children }: { children: ReactNode }) => (
  <>
    <Navbar />
    {children}
    <Footer />
  </>
);

const ProtectedRoute = ({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  allowedRoles?: string[];
}) => {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/dang-nhap" replace />;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dang-nhap" replace />;
  }
  return <>{children}</>;
};

export const AppRoutes = () => (
  <Routes>
    <Route path="/dang-nhap" element={<Login />} />
    <Route path="/dang-ky" element={<Register />} />
    <Route path="/quen-mat-khau" element={<ForgotPassword />} />

    <Route
      path="/ban-to-chuc"
      element={
        <ProtectedRoute allowedRoles={["organizer", "admin"]}>
          <OrganizerLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<OrganizerDashboard />} />
      <Route path="du-an" element={<OrganizerProjects />} />
      <Route path="hop-dong/:id" element={<ContractView />} />
      <Route path="trao-doi" element={<OrganizerCommunication />} />
      <Route path="nha-cung-cap" element={<OrganizerVendors />} />
      <Route path="ngan-sach" element={<OrganizerBudget />} />
      <Route path="bao-cao" element={<OrganizerReports />} />
      <Route path="thong-bao" element={<OrganizerNotifications />} />
      <Route path="ho-so" element={<OrganizerProfile />} />
    </Route>

    <Route
      path="/admin"
      element={
        <ProtectedRoute allowedRoles={["admin"]}>
          <AdminLayout />
        </ProtectedRoute>
      }
    >
      <Route index element={<AdminDashboard />} />
      <Route path="yeu-cau" element={<AdminRequests />} />
      <Route path="nguoi-dung" element={<AdminUsers />} />
      <Route path="noi-dung" element={<AdminContent />} />
      <Route path="hop-dong" element={<AdminContracts />} />
      <Route path="hop-dong/:id" element={<ContractView />} />
      <Route path="tai-chinh" element={<AdminFinance />} />
      <Route path="bao-cao" element={<AdminReports />} />
      <Route path="du-an" element={<AdminProjects />} />
      <Route path="nhan-su" element={<AdminStaff />} />
      <Route path="nha-cung-cap" element={<AdminVendors />} />
      <Route path="thong-bao" element={<AdminNotifications />} />
      <Route path="ho-so" element={<AdminProfile />} />
    </Route>

    <Route path="/" element={<PublicLayout><Index /></PublicLayout>} />
    <Route path="/dich-vu" element={<PublicLayout><Services /></PublicLayout>} />
    <Route path="/dich-vu/:slug" element={<PublicLayout><ServiceDetail /></PublicLayout>} />
    <Route path="/portfolio" element={<PublicLayout><Portfolio /></PublicLayout>} />
    <Route path="/portfolio/:slug" element={<PublicLayout><PortfolioDetail /></PublicLayout>} />
    <Route path="/blog" element={<PublicLayout><Blog /></PublicLayout>} />
    <Route path="/blog/:id" element={<PublicLayout><BlogDetail /></PublicLayout>} />
    <Route path="/lien-he" element={<PublicLayout><Contact /></PublicLayout>} />
    <Route path="/gioi-thieu" element={<PublicLayout><About /></PublicLayout>} />

    <Route path="/dashboard" element={<ProtectedRoute allowedRoles={["customer", "admin"]}><PublicLayout><CustomerDashboard /></PublicLayout></ProtectedRoute>} />
    <Route path="/dashboard/su-kien" element={<ProtectedRoute allowedRoles={["customer", "admin"]}><PublicLayout><MyEvents /></PublicLayout></ProtectedRoute>} />
    <Route path="/dashboard/su-kien/:id" element={<ProtectedRoute allowedRoles={["customer", "admin"]}><PublicLayout><EventTracking /></PublicLayout></ProtectedRoute>} />
    <Route path="/dashboard/hop-dong" element={<ProtectedRoute allowedRoles={["customer", "admin"]}><PublicLayout><MyContracts /></PublicLayout></ProtectedRoute>} />
    <Route path="/dashboard/hop-dong/:id" element={<ProtectedRoute allowedRoles={["customer", "admin", "organizer"]}><PublicLayout><ContractView /></PublicLayout></ProtectedRoute>} />
    <Route path="/dashboard/danh-gia" element={<ProtectedRoute allowedRoles={["customer", "admin"]}><PublicLayout><ReviewRating /></PublicLayout></ProtectedRoute>} />
    <Route path="/dashboard/ho-so" element={<ProtectedRoute allowedRoles={["customer", "admin"]}><PublicLayout><CustomerProfile /></PublicLayout></ProtectedRoute>} />

    <Route path="*" element={<PublicLayout><NotFound /></PublicLayout>} />
  </Routes>
);
