import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import Dashboard from './pages/Dashboard';
import AutomatedPipeline from './pages/AutomatedPipeline';
import OutreachCenter from './pages/OutreachCenter';
import InfluencerCRM from './pages/InfluencerCRM';
import AgentResearch from './pages/AgentResearch';
import InfluencerEngine from './pages/InfluencerEngine';
import ShopifyOAuth from './pages/ShopifyOAuth';
import PipelineTest from './pages/PipelineTest';
import ShopifyThemeBuilder from './pages/ShopifyThemeBuilder';
import ImportJobs from './pages/ImportJobs';
import Products from './pages/Products';
import OutreachBlast from './pages/OutreachBlast';
import OutreachTester from './pages/OutreachTester';
import Layout from './components/Layout';

const AuthenticatedApp = () => {
  const { isLoadingAuth, authError, isAuthenticated } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError?.type === 'auth_required' && !isAuthenticated) {
    // Could redirect to a login page or show a login form here.
    // For now, show a simple message.
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4 p-8">
          <h1 className="text-2xl font-bold text-slate-900">Authentication Required</h1>
          <p className="text-slate-500">Please log in to access Kaizen.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
          >
            Reload
          </button>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
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
        <Route path="/import-jobs" element={<ImportJobs />} />
        <Route path="/products" element={<Products />} />
        <Route path="/outreach-blast" element={<OutreachBlast />} />
        <Route path="*" element={<PageNotFound />} />
      </Route>
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
  );
}

export default App;
