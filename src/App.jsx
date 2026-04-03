import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
// Add page imports here
import OutreachTester from './pages/OutreachTester';
import Dashboard from './pages/Dashboard';
import AutomatedPipeline from './pages/AutomatedPipeline';
import OutreachCenter from './pages/OutreachCenter';
import InfluencerCRM from './pages/InfluencerCRM';
import AgentResearch from './pages/AgentResearch';
import InfluencerEngine from './pages/InfluencerEngine';
import ShopifyOAuth from './pages/ShopifyOAuth';
import { ShoppingBag } from 'lucide-react';
import PipelineTest from './pages/PipelineTest';
import ShopifyThemeBuilder from './pages/ShopifyThemeBuilder';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
    {/* Add your page Route elements here */}
    <Route path="/" element={<Dashboard />} />
    <Route path="/automated-pipeline" element={<AutomatedPipeline />} />
    <Route path="/outreach-center" element={<OutreachCenter />} />
      <Route path="/shopify-oauth" element={<ShopifyOAuth />} />
      <Route path="/pipeline-test" element={<PipelineTest />} />
      <Route path="/shopify-theme" element={<ShopifyThemeBuilder />} />
      <Route path="/influencer-engine" element={<InfluencerEngine />} />
      <Route path="/influencer-crm" element={<InfluencerCRM />} />
      <Route path="/agent-research" element={<AgentResearch />} />
      <Route path="/outreach-tester" element={<OutreachTester />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App