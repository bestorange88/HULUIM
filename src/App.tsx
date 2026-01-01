import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Auth from "./pages/Auth";
import SearchFriends from "./pages/SearchFriends";
import NotFound from "./pages/NotFound";
import ResponsiveLayout from "./components/layout/ResponsiveLayout";
import Discover from "./pages/Discover";
import NewsDetail from "./pages/NewsDetail";
import NewsList from "./pages/NewsList";
import MomentDetail from "./pages/MomentDetail";
import LuckyDraw from "./pages/LuckyDraw";
import ScanQRCode from "./pages/ScanQRCode";
import Conversations from "./pages/Conversations";
import Contacts from "./pages/Contacts";
import Groups from "./pages/Groups";
import Profile from "./pages/Profile";
import ChatDetail from "./pages/ChatDetail";
import Wallet from "./pages/Wallet";
import PersonalInfo from "./pages/PersonalInfo";
import NotificationSettings from "./pages/NotificationSettings";
import PrivacySecurity from "./pages/PrivacySecurity";
import GeneralSettings from "./pages/GeneralSettings";
import HelpFeedback from "./pages/HelpFeedback";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import AboutUs from "./pages/AboutUs";
import DeleteAccount from "./pages/DeleteAccount";
import OfflineIndicator from "./components/pwa/OfflineIndicator";
import PWAUpdatePrompt from "./components/pwa/PWAUpdatePrompt";
import RealNameVerification from "./pages/RealNameVerification";
import GlobalCallManager from "./components/call/GlobalCallManager";
import PushNotificationManager from "./components/push/PushNotificationManager";
import { CallProvider } from "./contexts/CallContext";
import { AdminAuthProvider } from "./contexts/AdminAuthContext";
import AdminLayout from "./components/admin/AdminLayout";
import AdminLogin from "./pages/admin/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminPerformanceMonitor from "./pages/admin/PerformanceMonitor";
import AdminUsers from "./pages/admin/Users";
import AdminConversations from "./pages/admin/Conversations";
import AdminMessages from "./pages/admin/Messages";
import AdminTransactions from "./pages/admin/Transactions";
import AdminRedEnvelopes from "./pages/admin/RedEnvelopes";
import AdminTransfers from "./pages/admin/Transfers";
import AdminCryptoReview from "./pages/admin/CryptoReview";
import AdminFinancialManagement from "./pages/admin/FinancialManagement";
import AdminFinancialReports from "./pages/admin/FinancialReports";
import AdminSensitiveWords from "./pages/admin/SensitiveWords";
import AdminPlatformSettings from "./pages/admin/PlatformSettings";
import AdminSettings from "./pages/admin/Settings";
import AdminArticles from "./pages/admin/Articles";

import AdminRealNameVerifications from "./pages/admin/RealNameVerifications";
import AdminPointProducts from "./pages/admin/PointProducts";
import AdminMembershipTiers from "./pages/admin/MembershipTiers";
import AdminPointOrders from "./pages/admin/PointOrders";
import AdminNews from "./pages/admin/News";
import AdminMoments from "./pages/admin/Moments";
import AdminSystemMessages from "./pages/admin/SystemMessages";
import AdminAvatarFrames from "./pages/admin/AvatarFrames";
import AdminLuckyDrawRecords from "./pages/admin/LuckyDrawRecords";
import AdminGifts from "./pages/admin/AdminGifts";
import AdminUserMemberships from "./pages/admin/UserMemberships";
import AdminCheckInSettings from "./pages/admin/CheckInSettings";
import AdminCustomerService from "./pages/admin/CustomerService";
import ProtectedAdminRoute from "./components/admin/ProtectedAdminRoute";
import JoinGroup from "./pages/JoinGroup";
import Referral from "./pages/Referral";
import MyPoints from "./pages/MyPoints";
import PointsMall from "./pages/PointsMall";
import MyOrders from "./pages/MyOrders";
import OrderDetail from "./pages/OrderDetail";
import MyFavorites from "./pages/MyFavorites";
import PointsExchange from "./pages/PointsExchange";

const queryClient = new QueryClient();

// Global auth state change listener for debugging cross-device session issues
const setupAuthDebugListener = () => {
  const deviceId = `${navigator.userAgent.slice(0, 50)}...`;
  
  supabase.auth.onAuthStateChange((event, session) => {
    console.log(
      '[GlobalAuthChange]',
      'event:', event,
      'user:', session?.user?.id,
      'email:', session?.user?.email,
      'device:', deviceId,
      'timestamp:', new Date().toISOString()
    );
  });
  
  // Also log initial session state
  supabase.auth.getSession().then(({ data: { session } }) => {
    console.log(
      '[GlobalAuthInit]',
      'user:', session?.user?.id,
      'email:', session?.user?.email,
      'device:', deviceId,
      'timestamp:', new Date().toISOString()
    );
  });
};

// Initialize auth debug listener immediately
setupAuthDebugListener();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <OfflineIndicator />
        <PWAUpdatePrompt />
        <BrowserRouter>
          <CallProvider>
            <GlobalCallManager />
            <PushNotificationManager />
            <Routes>
              <Route path="/" element={<Navigate to="/discover" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route element={<ResponsiveLayout />}>
                <Route path="/discover" element={<Discover />} />
                <Route path="/news" element={<NewsList />} />
                <Route path="/news/:id" element={<NewsDetail />} />
                <Route path="/moment/:momentId" element={<MomentDetail />} />
                <Route path="/lucky-draw" element={<LuckyDraw />} />
                <Route path="/conversations" element={<Conversations />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/groups" element={<Groups />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/chat/:conversationId" element={<ChatDetail />} />
                <Route path="/wallet" element={<Wallet />} />
                <Route path="/referral" element={<Referral />} />
                <Route path="/my-points" element={<MyPoints />} />
                <Route path="/points-mall" element={<PointsMall />} />
                <Route path="/points-exchange" element={<PointsExchange />} />
                <Route path="/my-orders" element={<MyOrders />} />
                <Route path="/order-detail/:orderId" element={<OrderDetail />} />
                <Route path="/my-favorites" element={<MyFavorites />} />
                <Route path="/personal-info" element={<PersonalInfo />} />
                <Route path="/notification-settings" element={<NotificationSettings />} />
                <Route path="/privacy-security" element={<PrivacySecurity />} />
                <Route path="/general-settings" element={<GeneralSettings />} />
                <Route path="/help-feedback" element={<HelpFeedback />} />
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/terms-of-service" element={<TermsOfService />} />
                <Route path="/about-us" element={<AboutUs />} />
                <Route path="/delete-account" element={<DeleteAccount />} />
                <Route path="/real-name-verification" element={<RealNameVerification />} />
                <Route path="/search-friends" element={<SearchFriends />} />
                <Route path="/scan-qr" element={<ScanQRCode />} />
              </Route>
              <Route path="/join/:code" element={<JoinGroup />} />
              
              {/* Admin routes */}
              <Route path="/superadmin/*" element={
                <AdminAuthProvider>
                  <Routes>
                    <Route path="login" element={<AdminLogin />} />
                    <Route element={<ProtectedAdminRoute />}>
                      <Route element={<AdminLayout />}>
                        <Route index element={<Navigate to="dashboard" replace />} />
                        <Route path="dashboard" element={<AdminDashboard />} />
                        <Route path="performance" element={<AdminPerformanceMonitor />} />
                        <Route path="users" element={<AdminUsers />} />
                        <Route path="conversations" element={<AdminConversations />} />
                        <Route path="messages" element={<AdminMessages />} />
                        <Route path="transactions" element={<AdminTransactions />} />
                        <Route path="red-envelopes" element={<AdminRedEnvelopes />} />
                        <Route path="transfers" element={<AdminTransfers />} />
                        <Route path="crypto-review" element={<AdminCryptoReview />} />
                        <Route path="financial" element={<AdminFinancialManagement />} />
                        <Route path="financial-reports" element={<AdminFinancialReports />} />
                        <Route path="sensitive-words" element={<AdminSensitiveWords />} />
                        <Route path="articles" element={<AdminArticles />} />
                        
                        <Route path="real-name-verifications" element={<AdminRealNameVerifications />} />
                        <Route path="point-products" element={<AdminPointProducts />} />
                        <Route path="membership-tiers" element={<AdminMembershipTiers />} />
                        <Route path="user-memberships" element={<AdminUserMemberships />} />
                        <Route path="point-orders" element={<AdminPointOrders />} />
                        <Route path="lucky-draw-records" element={<AdminLuckyDrawRecords />} />
                        <Route path="gifts" element={<AdminGifts />} />
                        <Route path="avatar-frames" element={<AdminAvatarFrames />} />
                        <Route path="checkin-settings" element={<AdminCheckInSettings />} />
                        <Route path="customer-service" element={<AdminCustomerService />} />
                        <Route path="system-messages" element={<AdminSystemMessages />} />
                        <Route path="news" element={<AdminNews />} />
                        <Route path="moments" element={<AdminMoments />} />
                        <Route path="platform-settings" element={<AdminPlatformSettings />} />
                        <Route path="settings" element={<AdminSettings />} />
                      </Route>
                    </Route>
                  </Routes>
                </AdminAuthProvider>
              } />
              
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </CallProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
