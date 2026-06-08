import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index.tsx";
import Services from "./pages/Services.tsx";
import ServiceDetail from "./pages/ServiceDetail.tsx";
import Portfolio from "./pages/Portfolio.tsx";
import PortfolioDetail from "./pages/PortfolioDetail.tsx";
import Blog from "./pages/Blog.tsx";
import BlogDetail from "./pages/BlogDetail.tsx";
import Contact from "./pages/Contact.tsx";
import About from "./pages/About.tsx";
import NotFound from "./pages/NotFound.tsx";
import Login from "./pages/Login.tsx";
import Register from "./pages/Register.tsx";
import ForgotPassword from "./pages/ForgotPassword.tsx";
// Customer
import CustomerDashboard from "./pages/customer/CustomerDashboard.tsx";
import MyEvents from "./pages/customer/MyEvents.tsx";
import EventTracking from "./pages/customer/EventTracking.tsx";
import MyContracts from "./pages/customer/MyContracts.tsx";
import ContractView from "./pages/customer/ContractView.tsx";
import ReviewRating from "./pages/customer/ReviewRating.tsx";
// Organizer
import OrganizerLayout from "./pages/organizer/OrganizerLayout.tsx";
import OrganizerDashboard from "./pages/organizer/OrganizerDashboard.tsx";
import OrganizerProjects from "./pages/organizer/OrganizerProjects.tsx";
import OrganizerCommunication from "./pages/organizer/OrganizerCommunication.tsx";
import OrganizerVendors from "./pages/organizer/OrganizerVendors.tsx";
import OrganizerBudget from "./pages/organizer/OrganizerBudget.tsx";
import OrganizerReports from "./pages/organizer/OrganizerReports.tsx";
// Admin
import AdminLayout from "./pages/admin/AdminLayout.tsx";
import AdminDashboard from "./pages/admin/AdminDashboard.tsx";
import AdminRequests from "./pages/admin/AdminRequests.tsx";
import AdminFinance from "./pages/admin/AdminFinance.tsx";
import AdminContracts from "./pages/admin/AdminContracts.tsx";
import AdminReports from "./pages/admin/AdminReports.tsx";
import AdminContent from "./pages/admin/AdminContent.tsx";
import AdminUsers from "./pages/admin/AdminUsers.tsx";
import AdminProjects from "./pages/admin/AdminProjects.tsx";
import AdminStaff from "./pages/admin/AdminStaff.tsx";
import AdminVendors from "./pages/admin/AdminVendors.tsx";
import AdminNotifications from "./pages/admin/AdminNotifications.tsx";
import AdminProfile from "./pages/admin/AdminProfile.tsx";
import OrganizerNotifications from "./pages/organizer/OrganizerNotifications.tsx";
import OrganizerProfile from "./pages/organizer/OrganizerProfile.tsx";
import CustomerProfile from "./pages/customer/CustomerProfile.tsx";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

const PublicLayout = ({ children }: { children: React.ReactNode }) => (
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
  children: React.ReactNode;
  allowedRoles?: string[];
}) => {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/dang-nhap" replace />;
  if (allowedRoles && user && !allowedRoles.includes(user.role))
    return <Navigate to="/dang-nhap" replace />;
  return <>{children}</>;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Auth */}
            <Route path="/dang-nhap" element={<Login />} />
            <Route path="/dang-ky" element={<Register />} />
            <Route path="/quen-mat-khau" element={<ForgotPassword />} />

            {/* Organizer Portal */}
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

            {/* Admin Panel */}
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

          {/* Public */}
          <Route path="/" element={<PublicLayout><Index /></PublicLayout>} />
          <Route path="/dich-vu" element={<PublicLayout><Services /></PublicLayout>} />
          <Route path="/dich-vu/:slug" element={<PublicLayout><ServiceDetail /></PublicLayout>} />
          <Route path="/portfolio" element={<PublicLayout><Portfolio /></PublicLayout>} />
          <Route path="/portfolio/:slug" element={<PublicLayout><PortfolioDetail /></PublicLayout>} />
          <Route path="/blog" element={<PublicLayout><Blog /></PublicLayout>} />
          <Route path="/blog/:id" element={<PublicLayout><BlogDetail /></PublicLayout>} />
          <Route path="/lien-he" element={<PublicLayout><Contact /></PublicLayout>} />
          <Route path="/gioi-thieu" element={<PublicLayout><About /></PublicLayout>} />

            {/* Customer */}
            <Route path="/dashboard" element={<ProtectedRoute allowedRoles={["customer", "admin"]}><PublicLayout><CustomerDashboard /></PublicLayout></ProtectedRoute>} />
            <Route path="/dashboard/su-kien" element={<ProtectedRoute allowedRoles={["customer", "admin"]}><PublicLayout><MyEvents /></PublicLayout></ProtectedRoute>} />
            <Route path="/dashboard/su-kien/:id" element={<ProtectedRoute allowedRoles={["customer", "admin"]}><PublicLayout><EventTracking /></PublicLayout></ProtectedRoute>} />
            <Route path="/dashboard/hop-dong" element={<ProtectedRoute allowedRoles={["customer", "admin"]}><PublicLayout><MyContracts /></PublicLayout></ProtectedRoute>} />
            <Route path="/dashboard/hop-dong/:id" element={<ProtectedRoute allowedRoles={["customer", "admin", "organizer"]}><PublicLayout><ContractView /></PublicLayout></ProtectedRoute>} />
            <Route path="/dashboard/danh-gia" element={<ProtectedRoute allowedRoles={["customer", "admin"]}><PublicLayout><ReviewRating /></PublicLayout></ProtectedRoute>} />
            <Route path="/dashboard/ho-so" element={<ProtectedRoute allowedRoles={["customer", "admin"]}><PublicLayout><CustomerProfile /></PublicLayout></ProtectedRoute>} />

            <Route path="*" element={<PublicLayout><NotFound /></PublicLayout>} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
