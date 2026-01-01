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
import MomentDetail from "./pages/MomentDetail";
import ScanQRCode from "./pages/ScanQRCode";
import Conversations from "./pages/Conversations";
import Contacts from "./pages/Contacts";
import Groups from "./pages/Groups";
import Profile from "./pages/Profile";
import ChatDetail from "./pages/ChatDetail";
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
import GlobalCallManager from "./components/call/GlobalCallManager";
import PushNotificationManager from "./components/push/PushNotificationManager";
import { CallProvider } from "./contexts/CallContext";
import JoinGroup from "./pages/JoinGroup";

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
                <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                <Route path="/terms-of-service" element={<TermsOfService />} />
                <Route path="/about-us" element={<AboutUs />} />
                <Route path="/delete-account" element={<DeleteAccount />} />
                <Route path="/search-friends" element={<SearchFriends />} />
                <Route path="/scan-qr" element={<ScanQRCode />} />
              </Route>
              <Route path="/join/:code" element={<JoinGroup />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </CallProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
