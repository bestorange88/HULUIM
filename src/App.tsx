import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import OfflineIndicator from "./components/pwa/OfflineIndicator";
import PWAUpdatePrompt from "./components/pwa/PWAUpdatePrompt";
import GlobalCallManager from "./components/call/GlobalCallManager";
import PushNotificationManager from "./components/push/PushNotificationManager";
import { CallProvider } from "./contexts/CallContext";
import { AdminAuthProvider } from "./contexts/AdminAuthContext";

// Lazy load pages for better code splitting
const Auth = lazy(() => import("./pages/Auth"));
const SearchFriends = lazy(() => import("./pages/SearchFriends"));
const NotFound = lazy(() => import("./pages/NotFound"));
const ResponsiveLayout = lazy(() => import("./components/layout/ResponsiveLayout"));
const Discover = lazy(() => import("./pages/Discover"));
const MomentDetail = lazy(() => import("./pages/MomentDetail"));
const ScanQRCode = lazy(() => import("./pages/ScanQRCode"));
const Conversations = lazy(() => import("./pages/Conversations"));
const Contacts = lazy(() => import("./pages/Contacts"));
const Groups = lazy(() => import("./pages/Groups"));
const Profile = lazy(() => import("./pages/Profile"));
const ChatDetail = lazy(() => import("./pages/ChatDetail"));
const PersonalInfo = lazy(() => import("./pages/PersonalInfo"));
const NotificationSettings = lazy(() => import("./pages/NotificationSettings"));
const PrivacySecurity = lazy(() => import("./pages/PrivacySecurity"));
const GeneralSettings = lazy(() => import("./pages/GeneralSettings"));
const HelpFeedback = lazy(() => import("./pages/HelpFeedback"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const AboutUs = lazy(() => import("./pages/AboutUs"));
const DeleteAccount = lazy(() => import("./pages/DeleteAccount"));
const JoinGroup = lazy(() => import("./pages/JoinGroup"));
const SystemMessages = lazy(() => import("./pages/SystemMessages"));
const MyFavorites = lazy(() => import("./pages/MyFavorites"));

// Admin pages - lazy loaded
const AdminLayout = lazy(() => import("./components/admin/AdminLayout"));
const AdminLogin = lazy(() => import("./pages/admin/Login"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminPerformanceMonitor = lazy(() => import("./pages/admin/PerformanceMonitor"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminConversations = lazy(() => import("./pages/admin/Conversations"));
const AdminMessages = lazy(() => import("./pages/admin/Messages"));
const AdminTransactions = lazy(() => import("./pages/admin/Transactions"));
const AdminRedEnvelopes = lazy(() => import("./pages/admin/RedEnvelopes"));
const AdminTransfers = lazy(() => import("./pages/admin/Transfers"));
const AdminCryptoReview = lazy(() => import("./pages/admin/CryptoReview"));
const AdminFinancialManagement = lazy(() => import("./pages/admin/FinancialManagement"));
const AdminFinancialReports = lazy(() => import("./pages/admin/FinancialReports"));
const AdminSensitiveWords = lazy(() => import("./pages/admin/SensitiveWords"));
const AdminPlatformSettings = lazy(() => import("./pages/admin/PlatformSettings"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const AdminArticles = lazy(() => import("./pages/admin/Articles"));
const AdminRealNameVerifications = lazy(() => import("./pages/admin/RealNameVerifications"));
const AdminPointProducts = lazy(() => import("./pages/admin/PointProducts"));
const AdminMembershipTiers = lazy(() => import("./pages/admin/MembershipTiers"));
const AdminPointOrders = lazy(() => import("./pages/admin/PointOrders"));
const AdminNews = lazy(() => import("./pages/admin/News"));
const AdminMoments = lazy(() => import("./pages/admin/Moments"));
const AdminSystemMessages = lazy(() => import("./pages/admin/SystemMessages"));
const AdminAvatarFrames = lazy(() => import("./pages/admin/AvatarFrames"));
const AdminLuckyDrawRecords = lazy(() => import("./pages/admin/LuckyDrawRecords"));
const AdminGifts = lazy(() => import("./pages/admin/AdminGifts"));
const AdminUserMemberships = lazy(() => import("./pages/admin/UserMemberships"));
const AdminCheckInSettings = lazy(() => import("./pages/admin/CheckInSettings"));
const AdminCustomerService = lazy(() => import("./pages/admin/CustomerService"));
const ProtectedAdminRoute = lazy(() => import("./components/admin/ProtectedAdminRoute"));

// Loading fallback component
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen bg-gradient-to-b from-purple-50/30 to-white">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
  </div>
);

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

// User-facing app with call functionality
const UserApp: React.FC = () => {
  return (
    <CallProvider>
      <GlobalCallManager />
      <PushNotificationManager />
      <Routes>
        <Route path="/" element={<Navigate to="/conversations" replace />} />
        <Route path="/auth" element={<Auth />} />
        <Route element={<ResponsiveLayout />}>
          <Route path="/discover" element={<Discover />} />
          <Route path="/moment/:momentId" element={<MomentDetail />} />
          <Route path="/conversations" element={<Conversations />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="/groups" element={<Groups />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/chat/:conversationId" element={<ChatDetail />} />
          <Route path="/personal-info" element={<PersonalInfo />} />
          <Route path="/notification-settings" element={<NotificationSettings />} />
          <Route path="/privacy-security" element={<PrivacySecurity />} />
          <Route path="/general-settings" element={<GeneralSettings />} />
          <Route path="/help-feedback" element={<HelpFeedback />} />
          <Route path="/help-center" element={<HelpCenter />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms-of-service" element={<TermsOfService />} />
          <Route path="/about-us" element={<AboutUs />} />
          <Route path="/delete-account" element={<DeleteAccount />} />
                    <Route path="/search-friends" element={<SearchFriends />} />
                    <Route path="/scan-qr" element={<ScanQRCode />} />
                    <Route path="/system-messages" element={<SystemMessages />} />
                    <Route path="/my-favorites" element={<MyFavorites />} />
                  </Route>
                  <Route path="/join/:code" element={<JoinGroup />} />
                  <Route path="*" element={<NotFound />} />
      </Routes>
    </CallProvider>
  );
};

// Admin app without call functionality
const AdminApp: React.FC = () => {
  return (
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
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <OfflineIndicator />
        <PWAUpdatePrompt />
        <BrowserRouter>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Admin routes - completely separate from user app, no call functionality */}
              <Route path="/superadmin/*" element={<AdminApp />} />
              {/* User routes - with call functionality */}
              <Route path="/*" element={<UserApp />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
