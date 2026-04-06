import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { FileStack, RefreshCw, Trash2, ArrowRight, CheckCircle, Clock, Loader, AlertCircle, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

const STATUS_CONFIG = {
  draft: { label: "Draft", icon: Clock, color: "bg-slate-100 text-slate-600" },
  enriching: { label: "Enriching", icon: RefreshCw, color: "bg-violet-100 text-violet-700" },
  importing: { label: "Importing", icon: Loader, color: "bg-amber-100 text-amber-700" },
  partially_done: { label: "Partial", icon: AlertCircle, color: "bg-orange-100 text-orange-700" },
  done: { label: "Done", icon: CheckCircle, color: "bg-emerald-100 text-emerald-700" },
};

export default function ImportJobs() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    const data = await base44.entities.ImportJob.list('-created_date', 50);
    setJobs(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const deleteJob = async (id) => {
    setDeleting(id);
    await base44.entities.ImportJob.delete(id);
    setJobs(prev => prev.filter(j => j.id !== id));
    setDeleting(null);
  };

  const openJob = (job) => {
    // Pass job data to research page via sessionStorage
    sessionStorage.setItem('resumeJob', JSON.stringify(job));
    navigate('/agent-research');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
          <FileStack className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900">Drafts & Import Jobs</p>
          <p className="text-xs text-slate-400">Resume saved research sessions and track outstanding imports</p>
        </div>
        <Link to="/agent-research">
          <Button size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white">
            <Plus className="w-3.5 h-3.5" /> New Research
          </Button>
        </Link>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-slate-400">
            <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading jobs…
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <FileStack className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">No saved sessions yet</p>
            <p className="text-sm text-slate-400 mt-1 mb-4">Run the AI Research Agent and save your session to resume it later</p>
            <Link to="/agent-research">
              <Button className="bg-violet-600 hover:bg-violet-700 text-white gap-2">
                <Plus className="w-4 h-4" /> Start Research Session
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map(job => {
              const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.draft;
              const StatusIcon = cfg.icon;
              const products = job.products_raw ? JSON.parse(job.products_raw) : [];
              const selectedArr = job.selected_indices ? JSON.parse(job.selected_indices) : [];
              const enrichedMap = job.enriched_map ? JSON.parse(job.enriched_map) : {};
              const enrichedCount = Object.keys(enrichedMap).length;

              return (
                <div key={job.id} className="bg-white rounded-xl border border-slate-200 p-5 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-900 truncate">{job.title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 ${cfg.color}`}>
                        <StatusIcon className="w-3 h-3" /> {cfg.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>📦 {products.length} products</span>
                      {selectedArr.length > 0 && <span>✅ {selectedArr.length} selected</span>}
                      {enrichedCount > 0 && <span>✨ {enrichedCount} enriched</span>}
                      {job.imported_count > 0 && <span>🛍️ {job.imported_count}/{job.total_count} imported</span>}
                      {job.regions?.length > 0 && <span>🌍 {job.regions.join(', ')}</span>}
                      <span>{new Date(job.created_date).toLocaleDateString()}</span>
                    </div>
                    {job.notes && <p className="text-xs text-slate-400 mt-1 italic">{job.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" onClick={() => openJob(job)} className="gap-1.5 bg-slate-900 text-white hover:bg-slate-700">
                      Resume <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={deleting === job.id}
                      onClick={() => deleteJob(job.id)}
                      className="text-red-400 hover:text-red-600 border-red-200"
                    >
                      {deleting === job.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}