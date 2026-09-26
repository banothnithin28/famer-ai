import React, { useState, useEffect, useMemo, useRef } from 'react';
import QRCode from 'qrcode';
import {
  Tractor,
  Clock,
  Play,
  Pause,
  CheckCircle2,
  AlertTriangle,
  QrCode,
  Share2,
  Copy,
  Receipt,
  User,
  MapPin,
  Calendar,
  Layers,
  ChevronRight,
  Plus,
  RefreshCw,
  Search,
  Filter,
  ArrowRight,
  ShieldCheck,
  FileText,
  DollarSign,
  AlertCircle,
  HelpCircle,
  Check,
  X,
  History,
  Info,
  Phone,
  Hash,
  ExternalLink,
  BookOpen
} from 'lucide-react';
import {
  getTractorJobs,
  createTractorJob,
  getTractorJob,
  joinTractorJob,
  startTractorJob,
  confirmStartTractorJob,
  pauseTractorJob,
  resumeTractorJob,
  finishTractorJob,
  confirmFinishTractorJob,
  disputeTractorJob,
  resolveDisputeTractorJob,
  addTractorToExpenses,
  getTractorSummary
} from '../services/apiService';

const WORK_TYPES = [
  'Ploughing',
  'Cultivating',
  'Rotavating',
  'Sowing',
  'Harvesting',
  'Transport',
  'Spraying',
  'Other'
];

const DISPUTE_REASONS = [
  'Incorrect start time',
  'Incorrect finish time',
  'Break time incorrect',
  'Work stopped because of rain',
  'Work stopped because of tractor problem',
  'Wrong rate',
  'Wrong field/work',
  'Other'
];

function formatSeconds(secs) {
  const s = Math.max(0, parseInt(secs || 0, 10));
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const remainingSecs = s % 60;
  if (hours > 0) {
    return `${hours}h ${mins}m ${remainingSecs}s`;
  }
  return `${mins}m ${remainingSecs}s`;
}

function formatDurationCompact(secs) {
  const s = Math.max(0, parseInt(secs || 0, 10));
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  if (hours > 0 && mins > 0) return `${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h`;
  return `${mins}m`;
}

function formatTimeOnly(isoString) {
  if (!isoString) return '--:--';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoString;
  }
}

function formatFullDate(isoString) {
  if (!isoString) return '';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return isoString;
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return isoString;
  }
}

export default function TractorTracker({ user, onNavigateToDiary }) {
  const [activeTab, setActiveTab] = useState('farmer'); // 'farmer' | 'driver' | 'history'
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  // Modals & Active Selections
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [qrModalJob, setQrModalJob] = useState(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [disputeModalOpen, setDisputeModalOpen] = useState(false);
  const [receiptModalOpen, setReceiptModalOpen] = useState(false);

  // Form states
  const [createForm, setCreateForm] = useState({
    work_date: new Date().toISOString().split('T')[0],
    field_name: 'Main Field',
    crop: 'Cotton',
    work_type: 'Ploughing',
    rate: '800',
    rate_unit: 'per_hour',
    field_size: '2.0',
    driver_name: '',
    driver_phone: '',
    tractor_number: '',
    notes: ''
  });
  const [submittingCreate, setSubmittingCreate] = useState(false);

  const [joinIdentifier, setJoinIdentifier] = useState('');
  const [joiningJob, setJoiningJob] = useState(false);
  const [joinPreviewJob, setJoinPreviewJob] = useState(null);

  const [pauseNotes, setPauseNotes] = useState('');
  const [pausePromptOpen, setPausePromptOpen] = useState(false);

  const [disputeReason, setDisputeReason] = useState(DISPUTE_REASONS[0]);
  const [disputeDesc, setDisputeDesc] = useState('');
  const [submittingDispute, setSubmittingDispute] = useState(false);

  // Filtering states for History
  const [historyFilter, setHistoryFilter] = useState({
    status: '',
    crop: '',
    search: '',
    work_type: ''
  });

  // Action feedback
  const [toastMessage, setToastMessage] = useState(null);
  const [copiedToken, setCopiedToken] = useState(false);

  // Live timer tick
  const [nowTimestamp, setNowTimestamp] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTimestamp(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const showToast = (msg, isError = false) => {
    setToastMessage({ text: msg, isError });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Load all jobs & summary
  const loadData = async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const [jobsRes, sumRes] = await Promise.all([
        getTractorJobs({ role: 'all' }),
        getTractorSummary()
      ]);

      if (jobsRes?.success && Array.isArray(jobsRes.jobs)) {
        setJobs(jobsRes.jobs);

        // Keep selected job updated if open
        if (selectedJob) {
          const updated = jobsRes.jobs.find((j) => j.id === selectedJob.id);
          if (updated) setSelectedJob(updated);
        }
      }

      if (sumRes?.success && sumRes.summary) {
        setSummary(sumRes.summary);
      }
    } catch (err) {
      console.error('Failed to load tractor tracker data:', err);
      showToast('Failed to load tractor records. Please retry.', true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Generate QR Code when QR modal is opened
  useEffect(() => {
    if (qrModalJob) {
      const joinPayload = JSON.stringify({
        app: 'FarmerAI',
        type: 'tractor_job',
        job_id: qrModalJob.job_id,
        token: qrModalJob.join_token
      });
      QRCode.toDataURL(joinPayload, {
        width: 260,
        margin: 2,
        color: {
          dark: '#1b4332',
          light: '#ffffff'
        }
      })
        .then((url) => setQrDataUrl(url))
        .catch((err) => console.error('QR code generation failed:', err));
    } else {
      setQrDataUrl('');
    }
  }, [qrModalJob]);

  // Create new tractor job
  const handleCreateJob = async (e) => {
    e.preventDefault();
    setSubmittingCreate(true);
    try {
      const payload = {
        ...createForm,
        rate: parseFloat(createForm.rate) || 0,
        field_size: parseFloat(createForm.field_size) || 0
      };
      const res = await createTractorJob(payload);
      if (res?.success && res.job) {
        showToast(`Job ${res.job.job_id} created successfully!`);
        setCreateModalOpen(false);
        setSelectedJob(res.job);
        setQrModalJob(res.job);
        await loadData(true);
      }
    } catch (err) {
      showToast(err.message || 'Failed to create job', true);
    } finally {
      setSubmittingCreate(false);
    }
  };

  // Preview / Join Tractor Job
  const handleLookupJob = async () => {
    if (!joinIdentifier.trim()) {
      showToast('Please enter a Job ID or join token.', true);
      return;
    }
    setJoiningJob(true);
    try {
      const res = await getTractorJob(joinIdentifier.trim());
      if (res?.success && res.job) {
        setJoinPreviewJob(res.job);
      } else {
        showToast('Job not found or access denied.', true);
      }
    } catch (err) {
      showToast(err.message || 'Job not found.', true);
    } finally {
      setJoiningJob(false);
    }
  };

  const handleConfirmJoin = async () => {
    if (!joinPreviewJob) return;
    setJoiningJob(true);
    try {
      const res = await joinTractorJob(joinPreviewJob.id);
      if (res?.success && res.job) {
        showToast(`Joined tractor job ${res.job.job_id} as driver!`);
        setJoinModalOpen(false);
        setJoinPreviewJob(null);
        setJoinIdentifier('');
        setSelectedJob(res.job);
        setActiveTab('driver');
        await loadData(true);
      }
    } catch (err) {
      showToast(err.message || 'Failed to join job.', true);
    } finally {
      setJoiningJob(false);
    }
  };

  // Workflow Handlers
  const handleStartWork = async (jobId) => {
    try {
      const res = await startTractorJob(jobId);
      if (res?.success) {
        showToast('Start request sent to driver for confirmation.');
        await loadData(true);
      }
    } catch (err) {
      showToast(err.message || 'Failed to start work', true);
    }
  };

  const handleConfirmStart = async (jobId) => {
    try {
      const res = await confirmStartTractorJob(jobId);
      if (res?.success) {
        showToast('Work started! Timer is now active.');
        await loadData(true);
      }
    } catch (err) {
      showToast(err.message || 'Failed to confirm start', true);
    }
  };

  const handlePauseWork = async (jobId) => {
    try {
      const res = await pauseTractorJob(jobId, pauseNotes);
      if (res?.success) {
        showToast('Work paused. Break duration will not be billed.');
        setPausePromptOpen(false);
        setPauseNotes('');
        await loadData(true);
      }
    } catch (err) {
      showToast(err.message || 'Failed to pause work', true);
    }
  };

  const handleResumeWork = async (jobId) => {
    try {
      const res = await resumeTractorJob(jobId);
      if (res?.success) {
        showToast('Work resumed.');
        await loadData(true);
      }
    } catch (err) {
      showToast(err.message || 'Failed to resume work', true);
    }
  };

  const handleFinishWork = async (jobId) => {
    try {
      const res = await finishTractorJob(jobId);
      if (res?.success) {
        showToast('Finish request registered. Awaiting confirmation.');
        await loadData(true);
      }
    } catch (err) {
      showToast(err.message || 'Failed to request finish', true);
    }
  };

  const handleConfirmFinish = async (jobId) => {
    try {
      const res = await confirmFinishTractorJob(jobId);
      if (res?.success) {
        showToast(`Work completed & finalized! Final Amount: ₹${res.job.final_amount.toLocaleString()}`);
        await loadData(true);
      }
    } catch (err) {
      showToast(err.message || 'Failed to confirm finish', true);
    }
  };

  const handleDispute = async (e) => {
    e.preventDefault();
    if (!selectedJob) return;
    setSubmittingDispute(true);
    try {
      const res = await disputeTractorJob(selectedJob.id, disputeReason, disputeDesc);
      if (res?.success) {
        showToast('Dispute recorded. Job status marked as DISPUTED.');
        setDisputeModalOpen(false);
        setDisputeDesc('');
        await loadData(true);
      }
    } catch (err) {
      showToast(err.message || 'Failed to register dispute', true);
    } finally {
      setSubmittingDispute(false);
    }
  };

  const handleResolveDispute = async (jobId, nextStatus = 'RUNNING') => {
    try {
      const res = await resolveDisputeTractorJob(jobId, 'Mutual agreement resolved', nextStatus);
      if (res?.success) {
        showToast(`Dispute resolved. Status set to ${nextStatus}.`);
        await loadData(true);
      }
    } catch (err) {
      showToast(err.message || 'Failed to resolve dispute', true);
    }
  };

  const handleAddToExpenses = async (jobId) => {
    try {
      const res = await addTractorToExpenses(jobId);
      if (res?.success) {
        showToast('Tractor payment successfully added to Farm Diary & Expenses!');
        await loadData(true);
      }
    } catch (err) {
      showToast(err.message || 'Failed to link expense', true);
    }
  };

  const copyToClipboard = (text) => {
    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
      showToast('Copied to clipboard!');
    }
  };

  // Filter jobs for Farmer View vs Driver View vs History
  const farmerJobs = useMemo(() => {
    return jobs.filter((j) => j.farmer_id === user?.id);
  }, [jobs, user]);

  const driverJobs = useMemo(() => {
    return jobs.filter((j) => j.driver_id === user?.id);
  }, [jobs, user]);

  const activeFarmerJob = useMemo(() => {
    return farmerJobs.find((j) => ['RUNNING', 'PAUSED', 'START_REQUESTED', 'FINISH_REQUESTED', 'DRIVER_JOINED', 'CREATED'].includes(j.status));
  }, [farmerJobs]);

  const activeDriverJob = useMemo(() => {
    return driverJobs.find((j) => ['RUNNING', 'PAUSED', 'START_REQUESTED', 'FINISH_REQUESTED', 'DRIVER_JOINED'].includes(j.status));
  }, [driverJobs]);

  const filteredHistoryJobs = useMemo(() => {
    return jobs.filter((j) => {
      if (historyFilter.status && j.status !== historyFilter.status) return false;
      if (historyFilter.crop && j.crop.toLowerCase() !== historyFilter.crop.toLowerCase()) return false;
      if (historyFilter.work_type && j.work_type.toLowerCase() !== historyFilter.work_type.toLowerCase()) return false;
      if (historyFilter.search) {
        const q = historyFilter.search.toLowerCase();
        const match =
          j.job_id.toLowerCase().includes(q) ||
          j.field_name.toLowerCase().includes(q) ||
          j.crop.toLowerCase().includes(q) ||
          (j.driver_name && j.driver_name.toLowerCase().includes(q)) ||
          (j.farmer_name && j.farmer_name.toLowerCase().includes(q));
        if (!match) return false;
      }
      return true;
    });
  }, [jobs, historyFilter]);

  // Calculate dynamic live working time & amount for a job
  const getJobLiveMetrics = (job) => {
    if (!job) return { seconds: 0, amount: 0, formattedTime: '00:00' };

    let liveSecs = job.live_active_seconds || job.total_working_seconds || 0;

    // If RUNNING, adjust with live tick from last STARTED/RESUMED event
    if (job.status === 'RUNNING' && job.events && job.events.length > 0) {
      const lastStartEvent = [...job.events]
        .reverse()
        .find((e) => e.event_type === 'STARTED' || e.event_type === 'RESUMED');

      if (lastStartEvent && lastStartEvent.server_timestamp) {
        const startMs = new Date(lastStartEvent.server_timestamp).getTime();
        const elapsedSinceStart = Math.max(0, Math.floor((nowTimestamp - startMs) / 1000));
        // Baseline seconds before current stretch
        const priorEvents = job.events.filter(
          (e) => new Date(e.server_timestamp).getTime() < startMs
        );
        let priorSecs = 0;
        let tempStart = null;
        for (const ev of priorEvents) {
          const t = new Date(ev.server_timestamp).getTime();
          if (ev.event_type === 'STARTED' || ev.event_type === 'RESUMED') {
            tempStart = t;
          } else if (['PAUSED', 'FINISHED', 'CANCELLED'].includes(ev.event_type) && tempStart) {
            priorSecs += Math.floor((t - tempStart) / 1000);
            tempStart = null;
          }
        }
        liveSecs = priorSecs + elapsedSinceStart;
      }
    }

    let calculatedAmount = 0;
    if (job.rate_unit === 'per_hour') {
      const hours = liveSecs / 3600;
      calculatedAmount = round2(hours * (job.rate || 0));
    } else if (job.rate_unit === 'per_acre') {
      const acres = job.field_size > 0 ? job.field_size : 1;
      calculatedAmount = round2(acres * (job.rate || 0));
    } else {
      calculatedAmount = round2(job.rate || 0);
    }

    if (job.status === 'COMPLETED') {
      calculatedAmount = job.final_amount || calculatedAmount;
      liveSecs = job.total_working_seconds || liveSecs;
    }

    return {
      seconds: liveSecs,
      amount: calculatedAmount,
      formattedTime: formatSeconds(liveSecs),
      compactTime: formatDurationCompact(liveSecs)
    };
  };

  function round2(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'RUNNING':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.65rem', borderRadius: 20, fontSize: '0.78rem', fontWeight: 800, background: 'var(--success-bg)', color: 'var(--primary)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'pulse 1.5s infinite' }} />
            WORKING (RUNNING)
          </span>
        );
      case 'PAUSED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.65rem', borderRadius: 20, fontSize: '0.78rem', fontWeight: 800, background: 'var(--warning-bg)', color: 'var(--warning)' }}>
            <Pause size={12} />
            PAUSED (BREAK)
          </span>
        );
      case 'COMPLETED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.65rem', borderRadius: 20, fontSize: '0.78rem', fontWeight: 800, background: 'color-mix(in srgb, var(--primary) 15%, transparent)', color: 'var(--primary)' }}>
            <CheckCircle2 size={12} />
            COMPLETED
          </span>
        );
      case 'START_REQUESTED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.65rem', borderRadius: 20, fontSize: '0.78rem', fontWeight: 800, background: 'var(--info-bg)', color: 'var(--info)' }}>
            <Clock size={12} />
            START PENDING
          </span>
        );
      case 'FINISH_REQUESTED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.65rem', borderRadius: 20, fontSize: '0.78rem', fontWeight: 800, background: 'var(--info-bg)', color: 'var(--info)' }}>
            <Clock size={12} />
            FINISH PENDING
          </span>
        );
      case 'DRIVER_JOINED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.65rem', borderRadius: 20, fontSize: '0.78rem', fontWeight: 800, background: 'var(--info-bg)', color: 'var(--info)' }}>
            <User size={12} />
            DRIVER JOINED
          </span>
        );
      case 'DISPUTED':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.65rem', borderRadius: 20, fontSize: '0.78rem', fontWeight: 800, background: 'var(--danger-bg)', color: 'var(--danger)' }}>
            <AlertTriangle size={12} />
            DISPUTED
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', padding: '0.25rem 0.65rem', borderRadius: 20, fontSize: '0.78rem', fontWeight: 800, background: 'var(--border)', color: 'var(--text-secondary)' }}>
            <Clock size={12} />
            CREATED
          </span>
        );
    }
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: '4rem' }}>

      {/* ─── Toast Feedback Alert ─── */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: 24,
            right: 24,
            zIndex: 9999,
            padding: '0.85rem 1.25rem',
            borderRadius: 'var(--radius-lg)',
            background: toastMessage.isError ? 'var(--danger)' : 'var(--primary)',
            color: '#ffffff',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.65rem',
            fontSize: '0.875rem',
            fontWeight: 700,
            animation: 'slideIn 0.25s ease'
          }}
        >
          {toastMessage.isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* ─── Header Banner ─── */}
      <div
        className="card"
        style={{
          padding: '1.75rem',
          borderRadius: 'var(--radius-2xl)',
          marginBottom: '1.5rem',
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--primary) 12%, var(--surface)) 0%, var(--surface) 100%)',
          border: '1px solid var(--border)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.35rem' }}>
              <span style={{
                width: 44, height: 44, borderRadius: 12,
                background: 'var(--primary)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px color-mix(in srgb, var(--primary) 35%, transparent)'
              }}>
                <Tractor size={26} />
              </span>
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
                  🚜 Tractor Work Tracker
                </h1>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Two-party timestamp logging, break exclusion & transparent billing
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.65rem' }}>
            <button
              onClick={() => setCreateModalOpen(true)}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.65rem 1.15rem', borderRadius: 'var(--radius-lg)', fontWeight: 800 }}
            >
              <Plus size={18} />
              <span>Create Tractor Job</span>
            </button>

            <button
              onClick={() => { setJoinModalOpen(true); setJoinPreviewJob(null); setJoinIdentifier(''); }}
              className="btn btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.65rem 1.15rem', borderRadius: 'var(--radius-lg)', fontWeight: 800 }}
            >
              <QrCode size={18} />
              <span>Join Job / Scan QR</span>
            </button>

            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              aria-label="Refresh tractor jobs"
              style={{
                width: 40, height: 40, borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border)', background: 'var(--surface)',
                color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={17} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
            </button>
          </div>
        </div>

        {/* ─── Role / View Navigation Tabs ─── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem', overflowX: 'auto' }}>
          <button
            onClick={() => setActiveTab('farmer')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.55rem 1.1rem', borderRadius: 'var(--radius-lg)',
              border: activeTab === 'farmer' ? '2px solid var(--primary)' : '1px solid var(--border)',
              background: activeTab === 'farmer' ? 'color-mix(in srgb, var(--primary) 12%, var(--surface))' : 'var(--surface)',
              color: activeTab === 'farmer' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 800, fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            <User size={16} />
            <span>Farmer View ({farmerJobs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('driver')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.55rem 1.1rem', borderRadius: 'var(--radius-lg)',
              border: activeTab === 'driver' ? '2px solid var(--primary)' : '1px solid var(--border)',
              background: activeTab === 'driver' ? 'color-mix(in srgb, var(--primary) 12%, var(--surface))' : 'var(--surface)',
              color: activeTab === 'driver' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 800, fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            <Tractor size={16} />
            <span>Driver View ({driverJobs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.55rem 1.1rem', borderRadius: 'var(--radius-lg)',
              border: activeTab === 'history' ? '2px solid var(--primary)' : '1px solid var(--border)',
              background: activeTab === 'history' ? 'color-mix(in srgb, var(--primary) 12%, var(--surface))' : 'var(--surface)',
              color: activeTab === 'history' ? 'var(--primary)' : 'var(--text-secondary)',
              fontWeight: 800, fontSize: '0.875rem', cursor: 'pointer', whiteSpace: 'nowrap'
            }}
          >
            <History size={16} />
            <span>All Work Records ({jobs.length})</span>
          </button>
        </div>
      </div>

      {/* ─── Main Content Tabs ─── */}
      {activeTab === 'farmer' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Farmer Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.25rem', borderRadius: 'var(--radius-xl)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Jobs</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {summary?.farmer?.active_jobs ?? 0}
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem', borderRadius: 'var(--radius-xl)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Completed Jobs</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--primary)', marginTop: '0.25rem' }}>
                {summary?.farmer?.completed_jobs ?? 0}
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem', borderRadius: 'var(--radius-xl)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pending Confirmations</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--warning)', marginTop: '0.25rem' }}>
                {summary?.farmer?.pending_confirmations ?? 0}
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem', borderRadius: 'var(--radius-xl)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Month Tractor Expenses</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                ₹{(summary?.farmer?.month_expenses ?? 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Active / Current Ongoing Tractor Work Spotlight */}
          {activeFarmerJob ? (
            <ActiveJobCard
              job={activeFarmerJob}
              userRole="farmer"
              metrics={getJobLiveMetrics(activeFarmerJob)}
              onShowQr={() => setQrModalJob(activeFarmerJob)}
              onStart={() => handleStartWork(activeFarmerJob.id)}
              onConfirmStart={() => handleConfirmStart(activeFarmerJob.id)}
              onPause={() => { setSelectedJob(activeFarmerJob); setPausePromptOpen(true); }}
              onResume={() => handleResumeWork(activeFarmerJob.id)}
              onFinish={() => handleFinishWork(activeFarmerJob.id)}
              onConfirmFinish={() => handleConfirmFinish(activeFarmerJob.id)}
              onDispute={() => { setSelectedJob(activeFarmerJob); setDisputeModalOpen(true); }}
              onViewDetails={() => setSelectedJob(activeFarmerJob)}
              onAddToExpenses={() => handleAddToExpenses(activeFarmerJob.id)}
              onViewReceipt={() => { setSelectedJob(activeFarmerJob); setReceiptModalOpen(true); }}
            />
          ) : (
            <div
              className="card"
              style={{
                padding: '2.5rem',
                borderRadius: 'var(--radius-2xl)',
                textAlign: 'center',
                background: 'var(--surface)',
                border: '1px dashed var(--border)'
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>🚜</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.4rem 0' }}>
                No active tractor jobs running right now
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: 460, margin: '0 auto 1.25rem auto' }}>
                Create a job when your tractor driver arrives. You can generate a QR code for the driver to scan and track active time accurately.
              </p>
              <button
                onClick={() => setCreateModalOpen(true)}
                className="btn btn-primary"
                style={{ padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-lg)', fontWeight: 800 }}
              >
                + Create Tractor Job
              </button>
            </div>
          )}

          {/* Farmer Recent Jobs List */}
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              My Created Jobs ({farmerJobs.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {farmerJobs.map((job) => (
                <JobRowCard
                  key={job.id}
                  job={job}
                  metrics={getJobLiveMetrics(job)}
                  onClick={() => setSelectedJob(job)}
                  onShowQr={() => setQrModalJob(job)}
                  onAddToExpenses={() => handleAddToExpenses(job.id)}
                  onViewReceipt={() => { setSelectedJob(job); setReceiptModalOpen(true); }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'driver' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Driver Metrics Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div className="card" style={{ padding: '1.25rem', borderRadius: 'var(--radius-xl)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Active Driver Jobs</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                {summary?.driver?.active_jobs ?? 0}
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem', borderRadius: 'var(--radius-xl)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Completed Work</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--primary)', marginTop: '0.25rem' }}>
                {summary?.driver?.completed_jobs ?? 0}
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem', borderRadius: 'var(--radius-xl)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Pending Requests</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--warning)', marginTop: '0.25rem' }}>
                {summary?.driver?.pending_requests ?? 0}
              </div>
            </div>

            <div className="card" style={{ padding: '1.25rem', borderRadius: 'var(--radius-xl)' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Earned</span>
              <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '0.25rem' }}>
                ₹{(summary?.driver?.total_earnings ?? 0).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Driver Active Job Spotlight */}
          {activeDriverJob ? (
            <ActiveJobCard
              job={activeDriverJob}
              userRole="driver"
              metrics={getJobLiveMetrics(activeDriverJob)}
              onShowQr={() => setQrModalJob(activeDriverJob)}
              onStart={() => handleStartWork(activeDriverJob.id)}
              onConfirmStart={() => handleConfirmStart(activeDriverJob.id)}
              onPause={() => { setSelectedJob(activeDriverJob); setPausePromptOpen(true); }}
              onResume={() => handleResumeWork(activeDriverJob.id)}
              onFinish={() => handleFinishWork(activeDriverJob.id)}
              onConfirmFinish={() => handleConfirmFinish(activeDriverJob.id)}
              onDispute={() => { setSelectedJob(activeDriverJob); setDisputeModalOpen(true); }}
              onViewDetails={() => setSelectedJob(activeDriverJob)}
              onAddToExpenses={() => handleAddToExpenses(activeDriverJob.id)}
              onViewReceipt={() => { setSelectedJob(activeDriverJob); setReceiptModalOpen(true); }}
            />
          ) : (
            <div
              className="card"
              style={{
                padding: '2.5rem',
                borderRadius: 'var(--radius-2xl)',
                textAlign: 'center',
                background: 'var(--surface)',
                border: '1px dashed var(--border)'
              }}
            >
              <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📲</div>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.4rem 0' }}>
                No active driver assignment
              </h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: 460, margin: '0 auto 1.25rem auto' }}>
                Ask the farmer to show their Job QR code or provide the Job ID (e.g., TR-20260926-001) to join work.
              </p>
              <button
                onClick={() => { setJoinModalOpen(true); setJoinPreviewJob(null); setJoinIdentifier(''); }}
                className="btn btn-primary"
                style={{ padding: '0.75rem 1.5rem', borderRadius: 'var(--radius-lg)', fontWeight: 800 }}
              >
                Scan QR / Enter Job ID
              </button>
            </div>
          )}

          {/* Driver Previous Jobs */}
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
              My Driving History ({driverJobs.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {driverJobs.map((job) => (
                <JobRowCard
                  key={job.id}
                  job={job}
                  metrics={getJobLiveMetrics(job)}
                  onClick={() => setSelectedJob(job)}
                  onShowQr={() => setQrModalJob(job)}
                  onAddToExpenses={() => handleAddToExpenses(job.id)}
                  onViewReceipt={() => { setSelectedJob(job); setReceiptModalOpen(true); }}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

          {/* Filters Bar */}
          <div
            className="card"
            style={{
              padding: '1.25rem',
              borderRadius: 'var(--radius-xl)',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: '0.75rem'
            }}
          >
            <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search by Job ID, field, crop, driver..."
                value={historyFilter.search}
                onChange={(e) => setHistoryFilter({ ...historyFilter, search: e.target.value })}
                className="input"
                style={{ paddingLeft: 36, width: '100%' }}
              />
            </div>

            <select
              value={historyFilter.status}
              onChange={(e) => setHistoryFilter({ ...historyFilter, status: e.target.value })}
              className="input"
              style={{ minWidth: 140 }}
            >
              <option value="">All Statuses</option>
              <option value="RUNNING">Running</option>
              <option value="PAUSED">Paused</option>
              <option value="COMPLETED">Completed</option>
              <option value="DISPUTED">Disputed</option>
              <option value="DRIVER_JOINED">Driver Joined</option>
              <option value="CREATED">Created</option>
            </select>

            <select
              value={historyFilter.work_type}
              onChange={(e) => setHistoryFilter({ ...historyFilter, work_type: e.target.value })}
              className="input"
              style={{ minWidth: 140 }}
            >
              <option value="">All Work Types</option>
              {WORK_TYPES.map((wt) => (
                <option key={wt} value={wt}>{wt}</option>
              ))}
            </select>
          </div>

          {/* Jobs List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {filteredHistoryJobs.length === 0 ? (
              <div className="card" style={{ padding: '2.5rem', textAlign: 'center', borderRadius: 'var(--radius-xl)', color: 'var(--text-muted)' }}>
                No tractor work records matching your filters.
              </div>
            ) : (
              filteredHistoryJobs.map((job) => (
                <JobRowCard
                  key={job.id}
                  job={job}
                  metrics={getJobLiveMetrics(job)}
                  onClick={() => setSelectedJob(job)}
                  onShowQr={() => setQrModalJob(job)}
                  onAddToExpenses={() => handleAddToExpenses(job.id)}
                  onViewReceipt={() => { setSelectedJob(job); setReceiptModalOpen(true); }}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL 1: Create Tractor Job Modal ─── */}
      {createModalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
          }}
          onClick={() => setCreateModalOpen(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: 540, width: '100%', maxHeight: '90vh', overflowY: 'auto',
              padding: '1.75rem', borderRadius: 'var(--radius-2xl)', background: 'var(--surface)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Tractor size={20} />
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Create Tractor Job
                </h3>
              </div>
              <button onClick={() => setCreateModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateJob} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Work Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={createForm.work_date}
                    onChange={(e) => setCreateForm({ ...createForm, work_date: e.target.value })}
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Crop *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Cotton, Paddy"
                    value={createForm.crop}
                    onChange={(e) => setCreateForm({ ...createForm, crop: e.target.value })}
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Field Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Main Field, North 4-Acres"
                    value={createForm.field_name}
                    onChange={(e) => setCreateForm({ ...createForm, field_name: e.target.value })}
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Work Type *
                  </label>
                  <select
                    value={createForm.work_type}
                    onChange={(e) => setCreateForm({ ...createForm, work_type: e.target.value })}
                    className="input"
                    style={{ width: '100%' }}
                  >
                    {WORK_TYPES.map((wt) => (
                      <option key={wt} value={wt}>{wt}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.85rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Agreed Rate (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="800"
                    value={createForm.rate}
                    onChange={(e) => setCreateForm({ ...createForm, rate: e.target.value })}
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Rate Unit *
                  </label>
                  <select
                    value={createForm.rate_unit}
                    onChange={(e) => setCreateForm({ ...createForm, rate_unit: e.target.value })}
                    className="input"
                    style={{ width: '100%' }}
                  >
                    <option value="per_hour">₹ / Hour</option>
                    <option value="per_acre">₹ / Acre</option>
                    <option value="fixed">Fixed Total ₹</option>
                  </select>
                </div>
              </div>

              {createForm.rate_unit === 'per_acre' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                    Field Size (Acres) *
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    required
                    placeholder="2.0"
                    value={createForm.field_size}
                    onChange={(e) => setCreateForm({ ...createForm, field_size: e.target.value })}
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.85rem', marginTop: '0.35rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Optional Driver Details
                </span>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem', marginTop: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Driver Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Ramesh"
                      value={createForm.driver_name}
                      onChange={(e) => setCreateForm({ ...createForm, driver_name: e.target.value })}
                      className="input"
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>Tractor No.</label>
                    <input
                      type="text"
                      placeholder="e.g. TS 08 AB 1234"
                      value={createForm.tractor_number}
                      onChange={(e) => setCreateForm({ ...createForm, tractor_number: e.target.value })}
                      className="input"
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingCreate}
                  className="btn btn-primary"
                  style={{ borderRadius: 'var(--radius-lg)', fontWeight: 800 }}
                >
                  {submittingCreate ? 'Creating Job...' : 'Create & Generate QR'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: QR Code & Join Link Display Modal ─── */}
      {qrModalJob && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
          }}
          onClick={() => setQrModalJob(null)}
        >
          <div
            className="card"
            style={{
              maxWidth: 420, width: '100%', textAlign: 'center',
              padding: '2rem', borderRadius: 'var(--radius-2xl)', background: 'var(--surface)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -8 }}>
              <button onClick={() => setQrModalJob(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', letterSpacing: '0.05em' }}>
              Tractor Job QR Code
            </span>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.25rem 0 0.25rem 0' }}>
              {qrModalJob.job_id}
            </h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: '0 0 1.25rem 0' }}>
              Show this QR code to the tractor driver to join this work session.
            </p>

            <div
              style={{
                background: '#ffffff',
                padding: '1rem',
                borderRadius: 'var(--radius-xl)',
                display: 'inline-block',
                boxShadow: 'var(--shadow-md)',
                marginBottom: '1.25rem'
              }}
            >
              {qrDataUrl ? (
                <img src={qrDataUrl} alt="Tractor Job QR Code" style={{ width: 220, height: 220, display: 'block' }} />
              ) : (
                <div style={{ width: 220, height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>
                  Generating QR...
                </div>
              )}
            </div>

            <div style={{ background: 'var(--background)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-lg)', marginBottom: '1.25rem', textAlign: 'left', fontSize: '0.82rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>Field & Crop:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{qrModalJob.crop} — {qrModalJob.field_name}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ color: 'var(--text-muted)' }}>Work Type:</span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{qrModalJob.work_type}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Agreed Rate:</span>
                <span style={{ fontWeight: 800, color: 'var(--primary)' }}>₹{qrModalJob.rate}/{qrModalJob.rate_unit === 'per_hour' ? 'hr' : qrModalJob.rate_unit === 'per_acre' ? 'acre' : 'fixed'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => copyToClipboard(qrModalJob.job_id)}
                className="btn btn-secondary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', borderRadius: 'var(--radius-lg)', fontWeight: 700 }}
              >
                {copiedToken ? <Check size={16} /> : <Copy size={16} />}
                <span>{copiedToken ? 'Copied!' : 'Copy Job ID'}</span>
              </button>
              <button
                onClick={() => setQrModalJob(null)}
                className="btn btn-primary"
                style={{ flex: 1, borderRadius: 'var(--radius-lg)', fontWeight: 700 }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: Join Job as Driver Modal ─── */}
      {joinModalOpen && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
          }}
          onClick={() => setJoinModalOpen(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: 480, width: '100%',
              padding: '1.75rem', borderRadius: 'var(--radius-2xl)', background: 'var(--surface)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <QrCode size={20} />
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Join Tractor Job
                </h3>
              </div>
              <button onClick={() => setJoinModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            {!joinPreviewJob ? (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                  Enter the Job ID provided by the farmer (e.g. <code>TR-20260926-001</code>) to view details and accept work.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
                  <input
                    type="text"
                    placeholder="Enter Job ID (e.g. TR-20260926-001)"
                    value={joinIdentifier}
                    onChange={(e) => setJoinIdentifier(e.target.value)}
                    className="input"
                    style={{ flex: 1 }}
                  />
                  <button
                    onClick={handleLookupJob}
                    disabled={joiningJob}
                    className="btn btn-primary"
                    style={{ borderRadius: 'var(--radius-lg)', fontWeight: 800 }}
                  >
                    {joiningJob ? 'Looking up...' : 'Find Job'}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ background: 'color-mix(in srgb, var(--primary) 8%, var(--surface))', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)', padding: '1.25rem', marginBottom: '1.25rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>
                    TRACTOR WORK REQUEST
                  </span>
                  <h4 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.25rem 0 0.85rem 0' }}>
                    {joinPreviewJob.job_id}
                  </h4>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.82rem' }}>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Farmer</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{joinPreviewJob.farmer_name || 'Farmer'}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Date</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{joinPreviewJob.work_date}</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Field & Crop</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{joinPreviewJob.crop} ({joinPreviewJob.field_name})</strong>
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Work Type</span>
                      <strong style={{ color: 'var(--text-primary)' }}>{joinPreviewJob.work_type}</strong>
                    </div>
                    <div style={{ gridColumn: 'span 2', borderTop: '1px solid var(--border)', paddingTop: '0.65rem', marginTop: '0.35rem' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'block' }}>Agreed Rate</span>
                      <strong style={{ fontSize: '1.1rem', color: 'var(--primary)' }}>
                        ₹{joinPreviewJob.rate} / {joinPreviewJob.rate_unit === 'per_hour' ? 'Hour' : joinPreviewJob.rate_unit === 'per_acre' ? 'Acre' : 'Fixed'}
                      </strong>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    onClick={() => setJoinPreviewJob(null)}
                    className="btn btn-secondary"
                    style={{ flex: 1, borderRadius: 'var(--radius-lg)' }}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleConfirmJoin}
                    disabled={joiningJob}
                    className="btn btn-primary"
                    style={{ flex: 1.5, borderRadius: 'var(--radius-lg)', fontWeight: 800 }}
                  >
                    {joiningJob ? 'Joining...' : 'Accept & Join Job'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL 4: Pause Work Break Reason Prompt ─── */}
      {pausePromptOpen && selectedJob && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
          }}
          onClick={() => setPausePromptOpen(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: 420, width: '100%',
              padding: '1.75rem', borderRadius: 'var(--radius-2xl)', background: 'var(--surface)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
              ⏸ Pause Tractor Work
            </h3>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              The timer will pause. This break time will be strictly omitted from the final payment calculation.
            </p>

            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
              Reason for pause / break:
            </label>
            <input
              type="text"
              placeholder="e.g. Lunch break, Refueling, Rain shower"
              value={pauseNotes}
              onChange={(e) => setPauseNotes(e.target.value)}
              className="input"
              style={{ width: '100%', marginBottom: '1.25rem' }}
            />

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                onClick={() => setPausePromptOpen(false)}
                className="btn btn-secondary"
                style={{ flex: 1, borderRadius: 'var(--radius-lg)' }}
              >
                Cancel
              </button>
              <button
                onClick={() => handlePauseWork(selectedJob.id)}
                className="btn btn-primary"
                style={{ flex: 1.5, borderRadius: 'var(--radius-lg)', background: 'var(--warning)', borderColor: 'var(--warning)', color: '#000', fontWeight: 800 }}
              >
                Confirm Pause
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 5: Raise Dispute Modal ─── */}
      {disputeModalOpen && selectedJob && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
          }}
          onClick={() => setDisputeModalOpen(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: 480, width: '100%',
              padding: '1.75rem', borderRadius: 'var(--radius-2xl)', background: 'var(--surface)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--danger)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <AlertTriangle size={20} />
                </span>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Raise Work Dispute
                </h3>
              </div>
              <button onClick={() => setDisputeModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleDispute} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Dispute Reason *
                </label>
                <select
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                >
                  {DISPUTE_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                  Explanation Note
                </label>
                <textarea
                  rows={3}
                  placeholder="Describe the discrepancy clearly (e.g., 'Tractor was halted for 45 minutes during rainfall')."
                  value={disputeDesc}
                  onChange={(e) => setDisputeDesc(e.target.value)}
                  className="input"
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setDisputeModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, borderRadius: 'var(--radius-lg)' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingDispute}
                  className="btn"
                  style={{ flex: 1.5, borderRadius: 'var(--radius-lg)', background: 'var(--danger)', color: '#fff', fontWeight: 800 }}
                >
                  {submittingDispute ? 'Submitting...' : 'Register Dispute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 6: Digital Work Record & Receipt Modal ─── */}
      {receiptModalOpen && selectedJob && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 999,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
          }}
          onClick={() => setReceiptModalOpen(false)}
        >
          <div
            className="card"
            style={{
              maxWidth: 480, width: '100%',
              padding: '2rem', borderRadius: 'var(--radius-2xl)', background: 'var(--surface)'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                <Receipt size={24} style={{ color: 'var(--primary)' }} />
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                    Tractor Work Receipt
                  </h3>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Verified Two-Party Digital Record</span>
                </div>
              </div>
              <button onClick={() => setReceiptModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Job ID:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{selectedJob.job_id}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Farmer:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{selectedJob.farmer_name || 'Farmer'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Driver:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{selectedJob.driver_name || selectedJob.driver_user_name || 'Assigned Driver'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Work Date:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{formatFullDate(selectedJob.work_date)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Field & Crop:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{selectedJob.crop} — {selectedJob.field_name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Work Activity:</span>
                <strong style={{ color: 'var(--text-primary)' }}>{selectedJob.work_type}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Active Working Time:</span>
                <strong style={{ color: 'var(--primary)' }}>{formatSeconds(selectedJob.total_working_seconds)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Agreed Rate:</span>
                <strong style={{ color: 'var(--text-primary)' }}>₹{selectedJob.rate}/{selectedJob.rate_unit === 'per_hour' ? 'Hour' : selectedJob.rate_unit === 'per_acre' ? 'Acre' : 'Fixed'}</strong>
              </div>

              {/* Grand Total Highlight */}
              <div style={{ background: 'color-mix(in srgb, var(--primary) 12%, var(--surface))', padding: '1rem', borderRadius: 'var(--radius-lg)', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>Total Payment</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary)' }}>
                  ₹{(selectedJob.final_amount || selectedJob.calculated_amount || 0).toLocaleString()}
                </span>
              </div>

              {/* Confirmations stamp */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', marginTop: '0.75rem', fontSize: '0.78rem' }}>
                <div style={{ background: 'var(--background)', padding: '0.65rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Farmer Confirmation</span>
                  <strong style={{ color: 'var(--primary)' }}>✅ Confirmed</strong>
                </div>
                <div style={{ background: 'var(--background)', padding: '0.65rem', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                  <span style={{ color: 'var(--text-muted)', display: 'block' }}>Driver Confirmation</span>
                  <strong style={{ color: 'var(--primary)' }}>✅ Confirmed</strong>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
              <button
                onClick={() => window.print()}
                className="btn btn-secondary"
                style={{ flex: 1, borderRadius: 'var(--radius-lg)' }}
              >
                Print / Save
              </button>
              <button
                onClick={() => setReceiptModalOpen(false)}
                className="btn btn-primary"
                style={{ flex: 1, borderRadius: 'var(--radius-lg)', fontWeight: 800 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 7: Job Details & Event Audit Trail ─── */}
      {selectedJob && !receiptModalOpen && !disputeModalOpen && !pausePromptOpen && (
        <JobDetailsModal
          job={selectedJob}
          user={user}
          metrics={getJobLiveMetrics(selectedJob)}
          onClose={() => setSelectedJob(null)}
          onShowQr={() => setQrModalJob(selectedJob)}
          onStart={() => handleStartWork(selectedJob.id)}
          onConfirmStart={() => handleConfirmStart(selectedJob.id)}
          onPause={() => setPausePromptOpen(true)}
          onResume={() => handleResumeWork(selectedJob.id)}
          onFinish={() => handleFinishWork(selectedJob.id)}
          onConfirmFinish={() => handleConfirmFinish(selectedJob.id)}
          onDispute={() => setDisputeModalOpen(true)}
          onResolveDispute={(nextStatus) => handleResolveDispute(selectedJob.id, nextStatus)}
          onAddToExpenses={() => handleAddToExpenses(selectedJob.id)}
          onViewReceipt={() => setReceiptModalOpen(true)}
          getStatusBadge={getStatusBadge}
        />
      )}

    </div>
  );
}


// ─── SUBCOMPONENT: Active Ongoing Job Card ───
function ActiveJobCard({
  job,
  userRole,
  metrics,
  onShowQr,
  onStart,
  onConfirmStart,
  onPause,
  onResume,
  onFinish,
  onConfirmFinish,
  onDispute,
  onViewDetails,
  onAddToExpenses,
  onViewReceipt
}) {
  const isRunning = job.status === 'RUNNING';
  const isPaused = job.status === 'PAUSED';
  const isStartRequested = job.status === 'START_REQUESTED';
  const isFinishRequested = job.status === 'FINISH_REQUESTED';
  const isDriverJoined = job.status === 'DRIVER_JOINED';
  const isCompleted = job.status === 'COMPLETED';
  const isDisputed = job.status === 'DISPUTED';

  return (
    <div
      className="card"
      style={{
        padding: '1.75rem',
        borderRadius: 'var(--radius-2xl)',
        background: 'var(--surface)',
        border: isRunning ? '2px solid var(--primary)' : isPaused ? '2px solid var(--warning)' : '1px solid var(--border)',
        boxShadow: isRunning ? '0 8px 30px color-mix(in srgb, var(--primary) 18%, transparent)' : 'var(--shadow-md)'
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <span style={{
            width: 42, height: 42, borderRadius: 12,
            background: isRunning ? 'var(--primary)' : isPaused ? 'var(--warning)' : 'var(--surface)',
            color: isRunning ? '#fff' : isPaused ? '#000' : 'var(--text-primary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '1px solid var(--border)'
          }}>
            <Tractor size={22} />
          </span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                {job.work_type}
              </h2>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '0.2rem 0.5rem', borderRadius: 6, background: 'var(--background)', color: 'var(--text-muted)' }}>
                {job.job_id}
              </span>
            </div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>
              {job.crop} — {job.field_name} • Driver: {job.driver_name || job.driver_user_name || 'Waiting to join'}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <button
            onClick={onShowQr}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem', borderRadius: 'var(--radius-lg)', fontSize: '0.8rem', fontWeight: 700 }}
          >
            <QrCode size={15} />
            <span>QR Code</span>
          </button>
          <button
            onClick={onViewDetails}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.85rem', borderRadius: 'var(--radius-lg)', fontSize: '0.8rem', fontWeight: 700 }}
          >
            <span>Timeline</span>
            <ChevronRight size={15} />
          </button>
        </div>
      </div>

      {/* Timer & Live Payment Gauge */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          background: 'var(--background)',
          padding: '1.25rem',
          borderRadius: 'var(--radius-xl)',
          marginBottom: '1.5rem',
          border: '1px solid var(--border)'
        }}
      >
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Active Working Time
          </span>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: isRunning ? 'var(--primary)' : 'var(--text-primary)', fontFamily: 'monospace', letterSpacing: '-0.02em', marginTop: '0.15rem' }}>
            {metrics.formattedTime}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            {isRunning ? '🟢 Active & billing' : isPaused ? '⏸ Break time excluded' : 'Server timestamp verified'}
          </span>
        </div>

        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            {isCompleted ? 'Final Amount' : 'Current Estimated Amount'}
          </span>
          <div style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--primary)', letterSpacing: '-0.02em', marginTop: '0.15rem' }}>
            ₹{metrics.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            Rate: ₹{job.rate} / {job.rate_unit === 'per_hour' ? 'Hour' : job.rate_unit === 'per_acre' ? 'Acre' : 'Fixed'}
          </span>
        </div>
      </div>

      {/* Two-Party Interactive Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '0.85rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.65rem' }}>

          {/* DRIVER_JOINED state */}
          {isDriverJoined && (
            <button
              onClick={onStart}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.35rem', borderRadius: 'var(--radius-lg)', fontWeight: 800 }}
            >
              <Play size={18} fill="currentColor" />
              <span>START WORK</span>
            </button>
          )}

          {/* START_REQUESTED state */}
          {isStartRequested && (
            <button
              onClick={onConfirmStart}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.35rem', borderRadius: 'var(--radius-lg)', fontWeight: 800 }}
            >
              <CheckCircle2 size={18} />
              <span>CONFIRM START</span>
            </button>
          )}

          {/* RUNNING state */}
          {isRunning && (
            <>
              <button
                onClick={onPause}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', borderRadius: 'var(--radius-lg)', fontWeight: 800, background: 'var(--warning-bg)', color: 'var(--warning)', borderColor: 'var(--warning)' }}
              >
                <Pause size={18} />
                <span>Pause Work (Break)</span>
              </button>

              <button
                onClick={onFinish}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', borderRadius: 'var(--radius-lg)', fontWeight: 800 }}
              >
                <CheckCircle2 size={18} />
                <span>FINISH WORK</span>
              </button>
            </>
          )}

          {/* PAUSED state */}
          {isPaused && (
            <>
              <button
                onClick={onResume}
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.35rem', borderRadius: 'var(--radius-lg)', fontWeight: 800 }}
              >
                <Play size={18} fill="currentColor" />
                <span>RESUME WORK</span>
              </button>

              <button
                onClick={onFinish}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.25rem', borderRadius: 'var(--radius-lg)', fontWeight: 800 }}
              >
                <CheckCircle2 size={18} />
                <span>Finish Work</span>
              </button>
            </>
          )}

          {/* FINISH_REQUESTED state */}
          {isFinishRequested && (
            <button
              onClick={onConfirmFinish}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem 1.35rem', borderRadius: 'var(--radius-lg)', fontWeight: 800 }}
            >
              <CheckCircle2 size={18} />
              <span>CONFIRM FINISH</span>
            </button>
          )}

          {/* COMPLETED state actions */}
          {isCompleted && (
            <>
              <button
                onClick={onViewReceipt}
                className="btn btn-secondary"
                style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 1.15rem', borderRadius: 'var(--radius-lg)', fontWeight: 800 }}
              >
                <Receipt size={17} />
                <span>View Receipt</span>
              </button>

              {userRole === 'farmer' && (
                job.expense_id ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: 'var(--primary)', fontWeight: 700, fontSize: '0.825rem' }}>
                    <CheckCircle2 size={16} />
                    <span>Added to Farm Expenses</span>
                  </span>
                ) : (
                  <button
                    onClick={onAddToExpenses}
                    className="btn btn-primary"
                    style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', padding: '0.6rem 1.15rem', borderRadius: 'var(--radius-lg)', fontWeight: 800 }}
                  >
                    <BookOpen size={17} />
                    <span>Add to Farm Expenses</span>
                  </button>
                )
              )}
            </>
          )}
        </div>

        {/* Dispute trigger */}
        {!isDisputed && (
          <button
            onClick={onDispute}
            style={{
              background: 'none', border: 'none',
              color: 'var(--danger)', fontSize: '0.8rem', fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem'
            }}
          >
            <AlertTriangle size={15} />
            <span>Raise Dispute</span>
          </button>
        )}
      </div>
    </div>
  );
}


// ─── SUBCOMPONENT: Job Row Card ───
function JobRowCard({ job, metrics, onClick, onShowQr, onAddToExpenses, onViewReceipt }) {
  const isCompleted = job.status === 'COMPLETED';

  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        padding: '1.15rem 1.35rem',
        borderRadius: 'var(--radius-xl)',
        background: 'var(--surface)',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '0.85rem',
        cursor: 'pointer',
        transition: 'transform 180ms ease, box-shadow 180ms ease'
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <span style={{
          width: 40, height: 40, borderRadius: 10,
          background: 'color-mix(in srgb, var(--primary) 12%, transparent)', color: 'var(--primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Tractor size={20} />
        </span>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
              {job.work_type}
            </span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
              {job.job_id}
            </span>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {job.crop} • {job.field_name} • {job.work_date}
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontWeight: 900, fontSize: '1.05rem', color: 'var(--text-primary)' }}>
            ₹{(job.final_amount || metrics.amount || 0).toLocaleString()}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
            {metrics.compactTime} • ₹{job.rate}/{job.rate_unit === 'per_hour' ? 'hr' : job.rate_unit === 'per_acre' ? 'acre' : 'fix'}
          </span>
        </div>

        <span style={{
          padding: '0.25rem 0.65rem', borderRadius: 20, fontSize: '0.75rem', fontWeight: 800,
          background: job.status === 'RUNNING' ? 'var(--success-bg)' : job.status === 'PAUSED' ? 'var(--warning-bg)' : 'var(--background)',
          color: job.status === 'RUNNING' ? 'var(--primary)' : job.status === 'PAUSED' ? 'var(--warning)' : 'var(--text-secondary)'
        }}>
          {job.status}
        </span>

        <ChevronRight size={18} style={{ color: 'var(--text-muted)' }} />
      </div>
    </div>
  );
}


// ─── SUBCOMPONENT: Full Job Details & Audit Trail Modal ───
function JobDetailsModal({
  job,
  user,
  metrics,
  onClose,
  onShowQr,
  onStart,
  onConfirmStart,
  onPause,
  onResume,
  onFinish,
  onConfirmFinish,
  onDispute,
  onResolveDispute,
  onAddToExpenses,
  onViewReceipt,
  getStatusBadge
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          maxWidth: 680, width: '100%', maxHeight: '92vh', overflowY: 'auto',
          padding: '2rem', borderRadius: 'var(--radius-2xl)', background: 'var(--surface)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '0.25rem' }}>
              <span style={{ width: 38, height: 38, borderRadius: 10, background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Tractor size={20} />
              </span>
              <div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                  Tractor Job #{job.job_id}
                </h3>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Created on {formatFullDate(job.created_at)}</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {getStatusBadge(job.status)}
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Job Parameters Summary */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '0.75rem',
            background: 'var(--background)',
            padding: '1.15rem',
            borderRadius: 'var(--radius-xl)',
            marginBottom: '1.5rem',
            fontSize: '0.82rem'
          }}
        >
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Farmer</span>
            <strong style={{ color: 'var(--text-primary)' }}>{job.farmer_name || 'Farmer'}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Driver</span>
            <strong style={{ color: 'var(--text-primary)' }}>{job.driver_name || job.driver_user_name || 'Not Assigned'}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Field & Crop</span>
            <strong style={{ color: 'var(--text-primary)' }}>{job.crop} ({job.field_name})</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Work Type</span>
            <strong style={{ color: 'var(--text-primary)' }}>{job.work_type}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Agreed Rate</span>
            <strong style={{ color: 'var(--primary)' }}>₹{job.rate} / {job.rate_unit === 'per_hour' ? 'Hour' : job.rate_unit === 'per_acre' ? 'Acre' : 'Fixed'}</strong>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.72rem' }}>Active Work Time</span>
            <strong style={{ color: 'var(--text-primary)' }}>{metrics.formattedTime}</strong>
          </div>
        </div>

        {/* Financial Summary */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'color-mix(in srgb, var(--primary) 10%, var(--surface))', padding: '1rem 1.25rem', borderRadius: 'var(--radius-xl)', marginBottom: '1.5rem' }}>
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>
              Calculated Total Amount
            </span>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--primary)' }}>
              ₹{(job.final_amount || metrics.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={onViewReceipt}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', fontWeight: 700, borderRadius: 'var(--radius-lg)' }}
            >
              Digital Receipt
            </button>
            <button
              onClick={onShowQr}
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', fontWeight: 700, borderRadius: 'var(--radius-lg)' }}
            >
              Show QR
            </button>
          </div>
        </div>

        {/* Dispute Resolution if Disputed */}
        {job.status === 'DISPUTED' && (
          <div style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-xl)', padding: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', fontWeight: 800, marginBottom: '0.5rem' }}>
              <AlertTriangle size={18} />
              <span>Work Dispute Active</span>
            </div>
            {job.disputes && job.disputes.length > 0 && (
              <p style={{ fontSize: '0.825rem', color: 'var(--text-primary)', margin: '0 0 0.75rem 0' }}>
                Reason: <strong>{job.disputes[0].reason}</strong> {job.disputes[0].description && `— ${job.disputes[0].description}`}
              </p>
            )}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => onResolveDispute('RUNNING')}
                className="btn btn-primary"
                style={{ fontSize: '0.8rem', fontWeight: 800, borderRadius: 'var(--radius-lg)' }}
              >
                Resolve & Resume Work
              </button>
              <button
                onClick={() => onResolveDispute('COMPLETED')}
                className="btn btn-secondary"
                style={{ fontSize: '0.8rem', fontWeight: 800, borderRadius: 'var(--radius-lg)' }}
              >
                Resolve & Finalize Job
              </button>
            </div>
          </div>
        )}

        {/* Audit Event Timeline */}
        <div>
          <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.85rem' }}>
            Event Audit History
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            {(!job.events || job.events.length === 0) ? (
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>No audit events logged yet.</p>
            ) : (
              job.events.map((ev, idx) => (
                <div
                  key={ev.id || idx}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.65rem 0.85rem',
                    background: 'var(--background)',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '0.8rem'
                  }}
                >
                  <span style={{ fontWeight: 800, color: 'var(--primary)', minWidth: 65 }}>
                    {formatTimeOnly(ev.server_timestamp)}
                  </span>
                  <div style={{ flex: 1 }}>
                    <strong style={{ color: 'var(--text-primary)', display: 'block' }}>
                      {ev.event_type}
                    </strong>
                    <span style={{ color: 'var(--text-secondary)' }}>
                      {ev.notes || `Action by ${ev.performed_by_name || 'User'}`}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
          <button
            onClick={onClose}
            className="btn btn-secondary"
            style={{ borderRadius: 'var(--radius-lg)' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
