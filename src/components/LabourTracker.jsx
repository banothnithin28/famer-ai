import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Users,
  PlusCircle,
  QrCode,
  CheckCircle2,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Square,
  AlertTriangle,
  CreditCard,
  Banknote,
  DollarSign,
  Calendar,
  Layers,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  Search,
  Filter,
  User,
  Phone,
  MapPin,
  Sprout,
  FileText,
  ShieldCheck,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Info,
  Handshake,
} from 'lucide-react';
import {
  getLabourJobs,
  createLabourJob,
  getLabourJob,
  joinLabourJob,
  agreeLabourJob,
  markLabourAttendance,
  getLabourAttendance,
  startLabourTimer,
  pauseLabourTimer,
  resumeLabourTimer,
  finishLabourTimer,
  confirmFinishLabourJob,
  recordLabourPayment,
  recordLabourAdvance,
  disputeLabourJob,
  resolveDisputeLabourJob,
  addLabourToExpenses,
  getLabourWorkerHistory,
  getLabourSummary,
} from '../services/apiService';

const WORK_TYPES = [
  'Cotton Harvesting',
  'Weeding',
  'Sowing / Transplanting',
  'Pesticide Spraying',
  'Pruning & Staking',
  'Field Ploughing',
  'Packing & Loading',
  'Irrigation / Channeling',
  'Fertilizer Broadcasting',
  'Other Farm Work',
];

const COMMON_CROPS = [
  'Cotton',
  'Paddy (Rice)',
  'Chilli (Mirchi)',
  'Tomato',
  'Maize (Corn)',
  'Wheat',
  'Sugarcane',
  'Groundnut',
  'Turmeric',
  'Vegetables',
  'Other Crop',
];

export default function LabourTracker({ user, onNavigateToDiary }) {
  const [jobs, setJobs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [cropFilter, setCropFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showWorkerHistoryModal, setShowWorkerHistoryModal] = useState(false);
  const [selectedJob, setSelectedJob] = useState(null);
  const [workerProfile, setWorkerProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // Form States
  const [createForm, setCreateForm] = useState({
    work_date: new Date().toISOString().split('T')[0],
    crop: 'Cotton',
    field_name: 'Field A',
    work_type: 'Cotton Harvesting',
    worker_name: '',
    worker_phone: '',
    payment_type: 'per_day',
    rate: '500',
    num_workers: '1',
    expected_start_date: new Date().toISOString().split('T')[0],
    expected_end_date: '',
    notes: '',
  });

  const [joinCode, setJoinCode] = useState('');
  const [previewJob, setPreviewJob] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const [attForm, setAttForm] = useState({
    date: new Date().toISOString().split('T')[0],
    worker_name: '',
    status: 'PRESENT',
    hours_worked: '8',
    notes: '',
  });

  const [payForm, setPayForm] = useState({
    worker_name: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'UPI',
    reference_no: '',
    notes: '',
  });

  const [advForm, setAdvForm] = useState({
    worker_name: '',
    amount: '',
    advance_date: new Date().toISOString().split('T')[0],
    payment_method: 'Cash',
    reference_no: '',
    notes: '',
  });

  const [disputeForm, setDisputeForm] = useState({
    reason: 'Attendance mismatch',
    description: '',
    evidence_text: '',
  });

  const [resolveForm, setResolveForm] = useState({
    resolution: 'Mutual agreement reached',
    next_status: 'AGREED',
  });

  // Action Loading states
  const [actionLoading, setActionLoading] = useState(false);

  const flashMessage = (msg, isErr = false) => {
    if (isErr) {
      setError(msg);
      setTimeout(() => setError(null), 5000);
    } else {
      setSuccessMsg(msg);
      setTimeout(() => setSuccessMsg(null), 4000);
    }
  };

  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    setRefreshing(true);
    try {
      const [jobsRes, sumRes] = await Promise.all([
        getLabourJobs(),
        getLabourSummary(),
      ]);

      if (jobsRes?.success && Array.isArray(jobsRes.jobs)) {
        setJobs(jobsRes.jobs);
      }
      if (sumRes?.success && sumRes.summary) {
        setSummary(sumRes.summary);
      }
    } catch (err) {
      console.error('Failed to load labour jobs:', err);
      flashMessage('Could not load labour jobs. Please check network connection.', true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filtered Jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      const matchStatus = statusFilter === 'ALL' || job.status === statusFilter;
      const matchCrop = cropFilter === 'ALL' || job.crop === cropFilter;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        job.job_id.toLowerCase().includes(q) ||
        job.work_type.toLowerCase().includes(q) ||
        job.crop.toLowerCase().includes(q) ||
        job.field_name.toLowerCase().includes(q) ||
        job.worker_name.toLowerCase().includes(q) ||
        (job.farmer_name && job.farmer_name.toLowerCase().includes(q));

      return matchStatus && matchCrop && matchSearch;
    });
  }, [jobs, statusFilter, cropFilter, searchQuery]);

  // ── Handlers ──

  // 1. Create Job
  const handleCreateJob = async (e) => {
    e.preventDefault();
    if (!createForm.crop || !createForm.field_name || !createForm.rate) {
      flashMessage('Please fill all required fields.', true);
      return;
    }
    setActionLoading(true);
    try {
      const payload = {
        ...createForm,
        rate: parseFloat(createForm.rate),
        num_workers: parseInt(createForm.num_workers) || 1,
      };
      const res = await createLabourJob(payload);
      if (res?.success) {
        flashMessage(res.message || 'Labour Job created successfully!');
        setShowCreateModal(false);
        setCreateForm({
          work_date: new Date().toISOString().split('T')[0],
          crop: 'Cotton',
          field_name: 'Field A',
          work_type: 'Cotton Harvesting',
          worker_name: '',
          worker_phone: '',
          payment_type: 'per_day',
          rate: '500',
          num_workers: '1',
          expected_start_date: new Date().toISOString().split('T')[0],
          expected_end_date: '',
          notes: '',
        });
        loadData(true);
      } else {
        flashMessage(res?.error || 'Failed to create job', true);
      }
    } catch (err) {
      flashMessage('Server error creating labour job', true);
    } finally {
      setActionLoading(false);
    }
  };

  // 2. Join / Lookup Job
  const handlePreviewJob = async () => {
    if (!joinCode.trim()) return;
    setPreviewLoading(true);
    try {
      const res = await getLabourJob(joinCode.trim());
      if (res?.success && res.job) {
        setPreviewJob(res.job);
      } else {
        flashMessage('Job not found. Verify Job ID or Join Token.', true);
        setPreviewJob(null);
      }
    } catch (err) {
      flashMessage('Job not found.', true);
      setPreviewJob(null);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleJoinJob = async () => {
    if (!previewJob) return;
    setActionLoading(true);
    try {
      const res = await joinLabourJob(previewJob.id);
      if (res?.success) {
        flashMessage(res.message || 'Joined job successfully!');
        setShowJoinModal(false);
        setJoinCode('');
        setPreviewJob(null);
        loadData(true);
      } else {
        flashMessage(res?.error || 'Could not join job', true);
      }
    } catch (err) {
      flashMessage('Failed to join job', true);
    } finally {
      setActionLoading(false);
    }
  };

  // 3. Work Agreement
  const handleAgree = async (jobId) => {
    setActionLoading(true);
    try {
      const res = await agreeLabourJob(jobId);
      if (res?.success) {
        flashMessage(res.message);
        loadData(true);
      } else {
        flashMessage(res?.error || 'Agreement failed', true);
      }
    } catch (err) {
      flashMessage('Error confirming agreement', true);
    } finally {
      setActionLoading(false);
    }
  };

  // 4. Mark Attendance
  const handleOpenAttendance = (job) => {
    setSelectedJob(job);
    setAttForm({
      date: new Date().toISOString().split('T')[0],
      worker_name: job.worker_name || (job.workers?.[0]?.name || ''),
      status: 'PRESENT',
      hours_worked: '8',
      notes: '',
    });
    setShowAttendanceModal(true);
  };

  const handleSaveAttendance = async (e) => {
    e.preventDefault();
    if (!selectedJob) return;
    setActionLoading(true);
    try {
      const res = await markLabourAttendance(selectedJob.id, attForm);
      if (res?.success) {
        flashMessage(res.message);
        setShowAttendanceModal(false);
        loadData(true);
      } else {
        flashMessage(res?.error || 'Failed to record attendance', true);
      }
    } catch (err) {
      flashMessage('Server error recording attendance', true);
    } finally {
      setActionLoading(false);
    }
  };

  // 5. Hourly Timer Controls
  const handleTimerAction = async (jobId, action, notes = '') => {
    setActionLoading(true);
    try {
      let res;
      if (action === 'start') res = await startLabourTimer(jobId);
      else if (action === 'pause') res = await pauseLabourTimer(jobId, notes);
      else if (action === 'resume') res = await resumeLabourTimer(jobId);
      else if (action === 'finish') res = await finishLabourTimer(jobId);
      else if (action === 'confirm-finish') res = await confirmFinishLabourJob(jobId);

      if (res?.success) {
        flashMessage(res.message);
        loadData(true);
      } else {
        flashMessage(res?.error || 'Action failed', true);
      }
    } catch (err) {
      flashMessage('Error processing timer action', true);
    } finally {
      setActionLoading(false);
    }
  };

  // 6. Record Payment
  const handleOpenPayment = (job) => {
    setSelectedJob(job);
    setPayForm({
      worker_name: job.worker_name || (job.workers?.[0]?.name || ''),
      amount: job.pending_amount > 0 ? String(job.pending_amount) : '',
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'UPI',
      reference_no: '',
      notes: '',
    });
    setShowPaymentModal(true);
  };

  const handleSavePayment = async (e) => {
    e.preventDefault();
    if (!selectedJob || !payForm.amount) return;
    setActionLoading(true);
    try {
      const res = await recordLabourPayment(selectedJob.id, {
        ...payForm,
        amount: parseFloat(payForm.amount),
      });
      if (res?.success) {
        flashMessage(res.message);
        setShowPaymentModal(false);
        loadData(true);
      } else {
        flashMessage(res?.error || 'Payment recording failed', true);
      }
    } catch (err) {
      flashMessage('Error recording payment', true);
    } finally {
      setActionLoading(false);
    }
  };

  // 7. Record Advance
  const handleOpenAdvance = (job) => {
    setSelectedJob(job);
    setAdvForm({
      worker_name: job.worker_name || (job.workers?.[0]?.name || ''),
      amount: '',
      advance_date: new Date().toISOString().split('T')[0],
      payment_method: 'Cash',
      reference_no: '',
      notes: '',
    });
    setShowAdvanceModal(true);
  };

  const handleSaveAdvance = async (e) => {
    e.preventDefault();
    if (!selectedJob || !advForm.amount) return;
    setActionLoading(true);
    try {
      const res = await recordLabourAdvance(selectedJob.id, {
        ...advForm,
        amount: parseFloat(advForm.amount),
      });
      if (res?.success) {
        flashMessage(res.message);
        setShowAdvanceModal(false);
        loadData(true);
      } else {
        flashMessage(res?.error || 'Advance recording failed', true);
      }
    } catch (err) {
      flashMessage('Error recording advance', true);
    } finally {
      setActionLoading(false);
    }
  };

  // 8. Disputes
  const handleOpenDispute = (job) => {
    setSelectedJob(job);
    setDisputeForm({
      reason: 'Attendance mismatch',
      description: '',
      evidence_text: '',
    });
    setShowDisputeModal(true);
  };

  const handleSaveDispute = async (e) => {
    e.preventDefault();
    if (!selectedJob || !disputeForm.description) {
      flashMessage('Please describe the dispute reason.', true);
      return;
    }
    setActionLoading(true);
    try {
      const res = await disputeLabourJob(
        selectedJob.id,
        disputeForm.reason,
        disputeForm.description,
        disputeForm.evidence_text
      );
      if (res?.success) {
        flashMessage(res.message);
        setShowDisputeModal(false);
        loadData(true);
      } else {
        flashMessage(res?.error || 'Dispute submission failed', true);
      }
    } catch (err) {
      flashMessage('Error submitting dispute', true);
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenResolve = (job) => {
    setSelectedJob(job);
    setResolveForm({
      resolution: 'Mutual agreement reached',
      next_status: 'AGREED',
    });
    setShowResolveModal(true);
  };

  const handleSaveResolve = async (e) => {
    e.preventDefault();
    if (!selectedJob) return;
    setActionLoading(true);
    try {
      const res = await resolveDisputeLabourJob(
        selectedJob.id,
        resolveForm.resolution,
        resolveForm.next_status
      );
      if (res?.success) {
        flashMessage(res.message);
        setShowResolveModal(false);
        loadData(true);
      } else {
        flashMessage(res?.error || 'Resolve failed', true);
      }
    } catch (err) {
      flashMessage('Error resolving dispute', true);
    } finally {
      setActionLoading(false);
    }
  };

  // 9. Add to Farm Expenses
  const handleAddToExpenses = async (jobId) => {
    setActionLoading(true);
    try {
      const res = await addLabourToExpenses(jobId);
      if (res?.success) {
        flashMessage(res.message);
        loadData(true);
      } else {
        flashMessage(res?.error || 'Could not record in Farm Diary', true);
      }
    } catch (err) {
      flashMessage('Error adding to Farm Expenses', true);
    } finally {
      setActionLoading(false);
    }
  };

  // 10. Worker History
  const handleViewWorkerHistory = async (workerName) => {
    if (!workerName) return;
    setLoadingProfile(true);
    setShowWorkerHistoryModal(true);
    try {
      const res = await getLabourWorkerHistory(workerName);
      if (res?.success && res.worker) {
        setWorkerProfile(res.worker);
      } else {
        flashMessage('Could not retrieve worker profile', true);
      }
    } catch (err) {
      flashMessage('Error loading worker history', true);
    } finally {
      setLoadingProfile(false);
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    switch (status) {
      case 'CREATED':
        return <span className="badge badge-warning">Awaiting Worker</span>;
      case 'WORKER_JOINED':
        return <span className="badge badge-info">Worker Joined</span>;
      case 'AGREED':
        return <span className="badge badge-success">Agreed & Ready</span>;
      case 'IN_PROGRESS':
        return <span className="badge badge-primary">In Progress</span>;
      case 'RUNNING':
        return <span className="badge badge-primary animate-pulse">⏱️ Working</span>;
      case 'PAUSED':
        return <span className="badge badge-warning">⏸️ Paused (Break)</span>;
      case 'FINISH_REQUESTED':
        return <span className="badge badge-warning">Confirmation Pending</span>;
      case 'COMPLETED':
        return <span className="badge badge-success">✅ Finalized</span>;
      case 'DISPUTED':
        return <span className="badge badge-danger">⚠️ Disputed</span>;
      default:
        return <span className="badge badge-neutral">{status}</span>;
    }
  };

  return (
    <div style={{ maxWidth: 1050, margin: '0 auto', paddingBottom: '4rem' }}>
      {/* ─── Header & Top Actions ─── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '1.25rem',
        }}
      >
        <div>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.2rem 0.65rem',
              borderRadius: 'var(--radius-full)',
              background: 'var(--success-bg)',
              color: 'var(--primary)',
              fontSize: '0.75rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              marginBottom: '0.35rem',
            }}
          >
            <span>👨‍🌾</span> Agricultural Workforce Module
          </div>
          <h1
            style={{
              fontSize: 'clamp(1.5rem, 3.5vw, 2.1rem)',
              fontWeight: 900,
              color: 'var(--text-primary)',
              margin: '0 0 0.35rem 0',
              letterSpacing: '-0.02em',
            }}
          >
            Labour Work Tracker
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, maxWidth: 650 }}>
            Record workers, daily attendance, hourly timesheets, agreed wages, advances, payments, and settlements.
          </p>
        </div>

        {/* Top Control Buttons */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => loadData(false)}
            disabled={refreshing}
            className="btn btn-secondary btn-sm"
            title="Refresh Data"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>

          <button
            onClick={() => {
              setPreviewJob(null);
              setJoinCode('');
              setShowJoinModal(true);
            }}
            className="btn btn-secondary btn-sm"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <QrCode size={16} />
            <span>Join / Scan QR</span>
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary btn-sm"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.45rem',
              boxShadow: '0 3px 10px color-mix(in srgb, var(--primary) 35%, transparent)',
            }}
          >
            <PlusCircle size={16} />
            <span>Create Labour Job</span>
          </button>
        </div>
      </div>

      {/* ─── Notification Alerts ─── */}
      {error && (
        <div className="card animate-fade-in" style={{ background: 'var(--danger-bg)', border: '1px solid var(--danger)', padding: '0.85rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--danger)' }}>
          <AlertTriangle size={18} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{error}</span>
        </div>
      )}
      {successMsg && (
        <div className="card animate-fade-in" style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', padding: '0.85rem 1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--primary)' }}>
          <CheckCircle2 size={18} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>{successMsg}</span>
        </div>
      )}

      {/* ─── 1. Labour Work Dashboard Summary Cards ─── */}
      <section style={{ marginBottom: '1.75rem' }} aria-label="Labour Financial Dashboard">
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '1rem',
          }}
        >
          {/* Card 1: Total Labour Cost */}
          <div
            className="card"
            style={{
              padding: '1.2rem',
              background: 'var(--surface)',
              borderTop: '4px solid var(--primary)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Total Labour Cost
              </span>
              <Users size={16} style={{ color: 'var(--primary)' }} />
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: '0.35rem' }}>
              ₹{(summary?.total_labour_cost || 0).toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Active Jobs: <strong>{summary?.active_jobs || 0}</strong> • Total: <strong>{summary?.total_workers || 0} workers</strong>
            </div>
          </div>

          {/* Card 2: Total Paid */}
          <div
            className="card"
            style={{
              padding: '1.2rem',
              background: 'var(--surface)',
              borderTop: '4px solid var(--success)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Total Amount Paid
              </span>
              <TrendingUp size={16} style={{ color: 'var(--success)' }} />
            </div>
            <div style={{ fontSize: '1.85rem', fontWeight: 900, color: 'var(--success)', lineHeight: 1.1, marginBottom: '0.35rem' }}>
              ₹{(summary?.total_paid || 0).toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Advances given: <strong>₹{(summary?.total_advance || 0).toLocaleString('en-IN')}</strong>
            </div>
          </div>

          {/* Card 3: Pending Payments */}
          <div
            className="card"
            style={{
              padding: '1.2rem',
              background: 'var(--surface)',
              borderTop: `4px solid ${(summary?.pending_payments || 0) > 0 ? 'var(--danger)' : 'var(--border)'}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Pending Wages
              </span>
              <TrendingDown size={16} style={{ color: (summary?.pending_payments || 0) > 0 ? 'var(--danger)' : 'var(--text-muted)' }} />
            </div>
            <div
              style={{
                fontSize: '1.85rem',
                fontWeight: 900,
                color: (summary?.pending_payments || 0) > 0 ? 'var(--danger)' : 'var(--text-primary)',
                lineHeight: 1.1,
                marginBottom: '0.35rem',
              }}
            >
              ₹{(summary?.pending_payments || 0).toLocaleString('en-IN')}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {(summary?.pending_payments || 0) > 0 ? 'Outstanding wage settlement' : 'All worker wages cleared'}
            </div>
          </div>

          {/* Card 4: Farm Diary Sync */}
          <div
            className="card"
            style={{
              padding: '1.2rem',
              background: 'var(--surface)',
              borderTop: '4px solid #0284C7',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Farm Diary Integration
                </span>
                <BookOpen size={16} style={{ color: '#0284C7' }} />
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0.2rem 0' }}>
                Synced Expenses
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                Automatic syncing to Farm Diary under category 'Labour'.
              </p>
            </div>
            <button
              onClick={() => onNavigateToDiary && onNavigateToDiary()}
              className="btn btn-secondary btn-sm"
              style={{ marginTop: '0.65rem', width: '100%', fontSize: '0.78rem', padding: '0.35rem' }}
            >
              Open Farm Diary →
            </button>
          </div>
        </div>

        {/* Crop-wise Expenses Breakdown Pills */}
        {summary?.crop_expenses?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginTop: '1rem' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Crop Labour Costs:
            </span>
            {summary.crop_expenses.map((c, i) => (
              <span
                key={i}
                style={{
                  background: 'var(--surface-secondary)',
                  border: '1px solid var(--border)',
                  padding: '0.25rem 0.65rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                }}
              >
                🌱 {c.crop}: <strong style={{ color: 'var(--primary)' }}>₹{(c.total_cost || 0).toLocaleString('en-IN')}</strong> ({c.jobs_count} jobs)
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ─── Search & Filtering Controls ─── */}
      <div
        className="card"
        style={{
          padding: '1rem',
          background: 'var(--surface)',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', flex: 1, minWidth: 220, position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search by Job ID, worker, crop, or field..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '2.2rem', fontSize: '0.85rem' }}
          />
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {/* Status Filter */}
          <select
            className="form-input"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ fontSize: '0.85rem', width: 'auto', padding: '0.45rem 0.85rem' }}
          >
            <option value="ALL">All Statuses</option>
            <option value="CREATED">Awaiting Worker</option>
            <option value="WORKER_JOINED">Worker Joined</option>
            <option value="AGREED">Agreed</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="RUNNING">Working</option>
            <option value="PAUSED">Paused</option>
            <option value="COMPLETED">Finalized</option>
            <option value="DISPUTED">Disputed</option>
          </select>

          {/* Crop Filter */}
          <select
            className="form-input"
            value={cropFilter}
            onChange={(e) => setCropFilter(e.target.value)}
            style={{ fontSize: '0.85rem', width: 'auto', padding: '0.45rem 0.85rem' }}
          >
            <option value="ALL">All Crops</option>
            {COMMON_CROPS.map((c, idx) => (
              <option key={idx} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ─── 2. Labour Jobs List ─── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem', animation: 'spin 1s infinite' }}>⚙️</div>
          <p style={{ fontWeight: 700 }}>Loading labour records…</p>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div
          className="card"
          style={{
            padding: '3.5rem 1.5rem',
            textAlign: 'center',
            background: 'var(--surface)',
          }}
        >
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👨‍🌾</div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
            No Labour Jobs Found
          </h3>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', maxWidth: 450, margin: '0 auto 1.5rem auto' }}>
            Create a new job for harvesting, weeding, sowing, or other agricultural tasks to track daily worker attendance, wages, advances, and settlements.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <PlusCircle size={18} />
            <span>Create First Labour Job</span>
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {filteredJobs.map((job) => {
            const isFarmer = job.is_farmer;
            const isWorker = job.is_worker;
            const isHourly = job.payment_type === 'per_hour';
            const isCompleted = job.status === 'COMPLETED';
            const isDisputed = job.status === 'DISPUTED';
            const isRunning = job.status === 'RUNNING';
            const isPaused = job.status === 'PAUSED';
            const needsAgreement = !job.farmer_agreed || !job.worker_agreed;

            return (
              <div
                key={job.id}
                className="card animate-fade-in"
                style={{
                  padding: '1.4rem',
                  background: 'var(--surface)',
                  border: isDisputed
                    ? '1.5px solid var(--danger)'
                    : isRunning
                    ? '1.5px solid var(--primary)'
                    : '1px solid var(--border)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                {/* Header Row */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    flexWrap: 'wrap',
                    gap: '0.75rem',
                    marginBottom: '1rem',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem' }}>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontWeight: 900,
                          fontSize: '0.95rem',
                          background: 'var(--surface-secondary)',
                          color: 'var(--primary)',
                          padding: '0.2rem 0.55rem',
                          borderRadius: 6,
                          border: '1px solid var(--border)',
                        }}
                      >
                        {job.job_id}
                      </span>
                      {renderStatusBadge(job.status)}
                    </div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.15rem 0' }}>
                      {job.work_type} • <span style={{ color: 'var(--primary)' }}>{job.crop}</span>
                    </h3>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                      <span>📍 Field: <strong>{job.field_name}</strong></span>
                      <span>📅 Date: <strong>{job.work_date}</strong></span>
                      <span>👥 Workers: <strong>{job.num_workers}</strong></span>
                      <span>💰 Rate: <strong>₹{job.rate}/{job.payment_type.replace('_', ' ')}</strong></span>
                    </div>
                  </div>

                  {/* Financial Summary Badge */}
                  <div
                    style={{
                      textAlign: 'right',
                      background: 'var(--surface-secondary)',
                      padding: '0.65rem 1rem',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                      Total Earned / Pending
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.1rem 0' }}>
                      ₹{job.total_earned.toLocaleString('en-IN')}
                    </div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: job.pending_amount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      {job.pending_amount > 0 ? `Pending: ₹${job.pending_amount.toLocaleString('en-IN')}` : '✅ Fully Paid'}
                    </div>
                  </div>
                </div>

                {/* Worker & Counterparty Information */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '0.75rem',
                    padding: '0.75rem 1rem',
                    background: 'var(--surface-secondary)',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1rem',
                    fontSize: '0.825rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <User size={16} style={{ color: 'var(--primary)' }} />
                    <span>
                      Worker:{' '}
                      <button
                        onClick={() => handleViewWorkerHistory(job.worker_name)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          color: 'var(--primary)',
                          fontWeight: 800,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        {job.worker_name}
                      </button>
                      {job.worker_phone && <span style={{ color: 'var(--text-muted)' }}> ({job.worker_phone})</span>}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', color: 'var(--text-secondary)' }}>
                    <span>Paid: <strong>₹{job.total_paid.toLocaleString('en-IN')}</strong></span>
                    <span>Advance: <strong>₹{job.total_advance.toLocaleString('en-IN')}</strong></span>
                    <span>Days: <strong>{job.total_days_worked}</strong></span>
                  </div>
                </div>

                {/* Work Agreement Prompt Banner if Not Finalized */}
                {needsAgreement && !isCompleted && (
                  <div
                    style={{
                      background: 'var(--warning-bg)',
                      border: '1px solid color-mix(in srgb, var(--warning) 30%, transparent)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.75rem 1rem',
                      marginBottom: '1rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.825rem', color: 'var(--warning-text)' }}>
                      <Handshake size={18} />
                      <span>
                        <strong>Work Agreement:</strong>{' '}
                        {job.farmer_agreed ? 'Farmer agreed.' : 'Awaiting Farmer agreement.'}{' '}
                        {job.worker_agreed ? 'Worker agreed.' : 'Awaiting Worker confirmation.'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleAgree(job.id)}
                      disabled={actionLoading}
                      className="btn btn-primary btn-sm"
                      style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem' }}
                    >
                      🤝 Agree to Work
                    </button>
                  </div>
                )}

                {/* Hourly Work Tracking Live Controls */}
                {isHourly && !isCompleted && (
                  <div
                    style={{
                      background: isRunning ? 'color-mix(in srgb, var(--primary) 8%, var(--surface))' : 'var(--surface-secondary)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      padding: '0.85rem 1rem',
                      marginBottom: '1rem',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.65rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                        <Clock size={16} style={{ color: 'var(--primary)' }} />
                        <span>Hourly Work Tracker</span>
                      </div>

                      <div style={{ fontSize: '0.85rem', fontWeight: 900, color: 'var(--primary)', fontFamily: 'monospace' }}>
                        Active Time: {Math.floor((job.live_active_seconds || 0) / 3600)}h {Math.floor(((job.live_active_seconds || 0) % 3600) / 60)}m
                      </div>
                    </div>

                    {/* Interactive Timer Control Buttons */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {!isRunning && !isPaused && (
                        <button
                          onClick={() => handleTimerAction(job.id, 'start')}
                          disabled={actionLoading}
                          className="btn btn-primary btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          <Play size={14} />
                          <span>START WORK</span>
                        </button>
                      )}

                      {isRunning && (
                        <button
                          onClick={() => handleTimerAction(job.id, 'pause', 'Lunch / Break')}
                          disabled={actionLoading}
                          className="btn btn-warning btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          <Pause size={14} />
                          <span>PAUSE (Break)</span>
                        </button>
                      )}

                      {isPaused && (
                        <button
                          onClick={() => handleTimerAction(job.id, 'resume')}
                          disabled={actionLoading}
                          className="btn btn-primary btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          <Play size={14} />
                          <span>RESUME WORK</span>
                        </button>
                      )}

                      {(isRunning || isPaused || job.status === 'FINISH_REQUESTED') && (
                        <button
                          onClick={() => handleTimerAction(job.id, 'confirm-finish')}
                          disabled={actionLoading}
                          className="btn btn-success btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                        >
                          <Check size={14} />
                          <span>FINISH WORK</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons Toolbar */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: '0.5rem',
                    borderTop: '1px solid var(--border)',
                    paddingTop: '0.85rem',
                  }}
                >
                  {/* Attendance */}
                  {!isCompleted && (
                    <button
                      onClick={() => handleOpenAttendance(job)}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
                    >
                      <Calendar size={14} />
                      <span>Mark Attendance</span>
                    </button>
                  )}

                  {/* Record Payment */}
                  <button
                    onClick={() => handleOpenPayment(job)}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
                  >
                    <CreditCard size={14} />
                    <span>Record Payment</span>
                  </button>

                  {/* Give Advance */}
                  <button
                    onClick={() => handleOpenAdvance(job)}
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
                  >
                    <Banknote size={14} />
                    <span>Give Advance</span>
                  </button>

                  {/* Two-Party Work Finalize */}
                  {!isCompleted && (
                    <button
                      onClick={() => handleTimerAction(job.id, 'confirm-finish')}
                      disabled={actionLoading}
                      className="btn btn-success btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
                    >
                      <CheckCircle2 size={14} />
                      <span>Confirm & Finalize Work</span>
                    </button>
                  )}

                  {/* Add to Farm Expenses */}
                  {isCompleted && !job.expense_id && (
                    <button
                      onClick={() => handleAddToExpenses(job.id)}
                      disabled={actionLoading}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem' }}
                    >
                      <BookOpen size={14} />
                      <span>Add to Farm Diary</span>
                    </button>
                  )}

                  {job.expense_id && (
                    <span
                      style={{
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: 'var(--primary)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.25rem',
                      }}
                    >
                      <CheckCircle2 size={14} />
                      In Farm Diary
                    </span>
                  )}

                  {/* Dispute Button */}
                  {!isDisputed && (
                    <button
                      onClick={() => handleOpenDispute(job)}
                      className="btn btn-secondary btn-sm"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        fontSize: '0.78rem',
                        marginLeft: 'auto',
                        color: 'var(--danger)',
                      }}
                    >
                      <AlertTriangle size={14} />
                      <span>Raise Dispute</span>
                    </button>
                  )}

                  {isDisputed && (
                    <button
                      onClick={() => handleOpenResolve(job)}
                      className="btn btn-warning btn-sm"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.78rem', marginLeft: 'auto' }}
                    >
                      <CheckCircle2 size={14} />
                      <span>Resolve Dispute</span>
                    </button>
                  )}
                </div>

                {/* Attendance Summary Drawer */}
                {job.attendance?.length > 0 && (
                  <div style={{ marginTop: '0.85rem', paddingTop: '0.65rem', borderTop: '1px dashed var(--border)' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                      Recent Attendance Logs ({job.attendance.length} entries):
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                      {job.attendance.slice(0, 5).map((a, i) => (
                        <span
                          key={i}
                          style={{
                            background:
                              a.status === 'PRESENT'
                                ? 'var(--success-bg)'
                                : a.status === 'HALF_DAY'
                                ? 'var(--warning-bg)'
                                : 'var(--danger-bg)',
                            color:
                              a.status === 'PRESENT'
                                ? 'var(--primary)'
                                : a.status === 'HALF_DAY'
                                ? 'var(--warning-text)'
                                : 'var(--danger)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: 6,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                          }}
                        >
                          {a.date}: {a.status === 'PRESENT' ? 'Present' : a.status === 'HALF_DAY' ? 'Half Day' : 'Absent'} (₹{a.wage_amount})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 1: CREATE LABOUR JOB
      ══════════════════════════════════════════════════════════════════════ */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-card animate-scale-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <PlusCircle size={20} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                  Create Labour Job
                </h2>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateJob} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">Crop Name *</label>
                  <select
                    className="form-input"
                    value={createForm.crop}
                    onChange={(e) => setCreateForm({ ...createForm, crop: e.target.value })}
                  >
                    {COMMON_CROPS.map((c, i) => (
                      <option key={i} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Field Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Field A / North Plot"
                    value={createForm.field_name}
                    onChange={(e) => setCreateForm({ ...createForm, field_name: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Work Type *</label>
                <select
                  className="form-input"
                  value={createForm.work_type}
                  onChange={(e) => setCreateForm({ ...createForm, work_type: e.target.value })}
                >
                  {WORK_TYPES.map((w, i) => (
                    <option key={i} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">Worker / Gang Leader Name</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. Ramesh"
                    value={createForm.worker_name}
                    onChange={(e) => setCreateForm({ ...createForm, worker_name: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Worker Phone (Optional)</label>
                  <input
                    type="tel"
                    className="form-input"
                    placeholder="e.g. 9876543210"
                    value={createForm.worker_phone}
                    onChange={(e) => setCreateForm({ ...createForm, worker_phone: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">Payment Type</label>
                  <select
                    className="form-input"
                    value={createForm.payment_type}
                    onChange={(e) => setCreateForm({ ...createForm, payment_type: e.target.value })}
                  >
                    <option value="per_day">Per Day (₹/day)</option>
                    <option value="per_hour">Per Hour (₹/hr)</option>
                    <option value="fixed">Fixed Amount (₹)</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Agreed Rate (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    step="10"
                    className="form-input"
                    value={createForm.rate}
                    onChange={(e) => setCreateForm({ ...createForm, rate: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">No. of Workers</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    className="form-input"
                    value={createForm.num_workers}
                    onChange={(e) => setCreateForm({ ...createForm, num_workers: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">Expected Start Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={createForm.expected_start_date}
                    onChange={(e) => setCreateForm({ ...createForm, expected_start_date: e.target.value })}
                  />
                </div>

                <div>
                  <label className="form-label">Expected End Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={createForm.expected_end_date}
                    onChange={(e) => setCreateForm({ ...createForm, expected_end_date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Work Conditions / Notes</label>
                <textarea
                  className="form-input"
                  rows="2"
                  placeholder="e.g. Lunch provided, harvest round 1..."
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}
                >
                  <PlusCircle size={16} />
                  <span>{actionLoading ? 'Creating...' : 'Create Job & Generate ID'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 2: JOIN / SCAN QR CODE
      ══════════════════════════════════════════════════════════════════════ */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal-card animate-scale-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <QrCode size={20} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                  Worker Job Joining
                </h2>
              </div>
              <button onClick={() => setShowJoinModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={16} />
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 1rem 0' }}>
              Enter the unique <strong>Labour Job ID</strong> (e.g. LAB-1025) or join token provided by the farmer.
            </p>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. LAB-20261002-001 or LAB-1025"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value)}
              />
              <button
                type="button"
                onClick={handlePreviewJob}
                disabled={previewLoading || !joinCode.trim()}
                className="btn btn-primary"
              >
                {previewLoading ? 'Checking...' : 'Find Job'}
              </button>
            </div>

            {previewJob && (
              <div
                className="animate-fade-in"
                style={{
                  background: 'var(--surface-secondary)',
                  border: '1.5px solid var(--primary)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.2rem',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)', marginBottom: '0.25rem' }}>
                  Job Details Preview:
                </div>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0 0 0.35rem 0' }}>
                  {previewJob.work_type} • {previewJob.crop}
                </h3>
                <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '1rem' }}>
                  <div>📍 <strong>Field:</strong> {previewJob.field_name}</div>
                  <div>💰 <strong>Rate:</strong> ₹{previewJob.rate} / {previewJob.payment_type.replace('_', ' ')}</div>
                  <div>📅 <strong>Date:</strong> {previewJob.work_date}</div>
                  <div>👨‍🌾 <strong>Farmer:</strong> {previewJob.farmer_name || 'Farm Owner'}</div>
                </div>

                <button
                  onClick={handleJoinJob}
                  disabled={actionLoading}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '0.65rem' }}
                >
                  {actionLoading ? 'Joining...' : 'Accept & Join Job Record'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 3: MARK ATTENDANCE
      ══════════════════════════════════════════════════════════════════════ */}
      {showAttendanceModal && selectedJob && (
        <div className="modal-overlay" onClick={() => setShowAttendanceModal(false)}>
          <div className="modal-card animate-scale-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={20} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                  Mark Daily Attendance
                </h2>
              </div>
              <button onClick={() => setShowAttendanceModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveAttendance} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label">Worker Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={attForm.worker_name}
                  onChange={(e) => setAttForm({ ...attForm, worker_name: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={attForm.date}
                  onChange={(e) => setAttForm({ ...attForm, date: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="form-label">Attendance Status *</label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  {[
                    { id: 'PRESENT', label: '✅ Present', desc: '1.0 Full Day' },
                    { id: 'HALF_DAY', label: '🌗 Half Day', desc: '0.5 Day' },
                    { id: 'ABSENT', label: '❌ Absent', desc: '0.0 Day' },
                  ].map((s) => {
                    const isSel = attForm.status === s.id;
                    return (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => setAttForm({ ...attForm, status: s.id })}
                        style={{
                          padding: '0.75rem 0.5rem',
                          borderRadius: 'var(--radius-md)',
                          border: `1.5px solid ${isSel ? 'var(--primary)' : 'var(--border)'}`,
                          background: isSel ? 'var(--success-bg)' : 'var(--surface-secondary)',
                          color: isSel ? 'var(--primary)' : 'var(--text-primary)',
                          cursor: 'pointer',
                          textAlign: 'center',
                          transition: 'all 160ms',
                        }}
                      >
                        <div style={{ fontWeight: 800, fontSize: '0.85rem' }}>{s.label}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{s.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Calculated Wage Preview */}
              <div
                style={{
                  background: 'var(--surface-secondary)',
                  padding: '0.85rem',
                  borderRadius: 8,
                  fontSize: '0.85rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <span>Calculated Wage for Day:</span>
                <strong style={{ fontSize: '1.15rem', color: 'var(--primary)' }}>
                  ₹
                  {attForm.status === 'PRESENT'
                    ? selectedJob.rate
                    : attForm.status === 'HALF_DAY'
                    ? selectedJob.rate * 0.5
                    : 0}
                </strong>
              </div>

              <div>
                <label className="form-label">Notes (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Overtime 1 hour or morning half"
                  value={attForm.notes}
                  onChange={(e) => setAttForm({ ...attForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAttendanceModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn btn-primary"
                >
                  {actionLoading ? 'Recording...' : 'Save Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 4: RECORD PAYMENT
      ══════════════════════════════════════════════════════════════════════ */}
      {showPaymentModal && selectedJob && (
        <div className="modal-overlay" onClick={() => setShowPaymentModal(false)}>
          <div className="modal-card animate-scale-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CreditCard size={20} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                  Record Wage Payment
                </h2>
              </div>
              <button onClick={() => setShowPaymentModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSavePayment} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label">Worker Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={payForm.worker_name}
                  onChange={(e) => setPayForm({ ...payForm, worker_name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">Amount (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    step="10"
                    className="form-input"
                    value={payForm.amount}
                    onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Payment Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={payForm.payment_date}
                    onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">Payment Method</label>
                  <select
                    className="form-input"
                    value={payForm.payment_method}
                    onChange={(e) => setPayForm({ ...payForm, payment_method: e.target.value })}
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI (GooglePay / PhonePe)</option>
                    <option value="Bank Transfer">Bank Transfer (NEFT/IMPS)</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="form-label">Reference / Txn No</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. UPI-123456"
                    value={payForm.reference_no}
                    onChange={(e) => setPayForm({ ...payForm, reference_no: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Final settlement for 3 days"
                  value={payForm.notes}
                  onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowPaymentModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn btn-primary"
                >
                  {actionLoading ? 'Recording...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 5: RECORD ADVANCE
      ══════════════════════════════════════════════════════════════════════ */}
      {showAdvanceModal && selectedJob && (
        <div className="modal-overlay" onClick={() => setShowAdvanceModal(false)}>
          <div className="modal-card animate-scale-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Banknote size={20} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                  Record Advance Given
                </h2>
              </div>
              <button onClick={() => setShowAdvanceModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveAdvance} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label">Worker Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={advForm.worker_name}
                  onChange={(e) => setAdvForm({ ...advForm, worker_name: e.target.value })}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label className="form-label">Advance Amount (₹) *</label>
                  <input
                    type="number"
                    min="1"
                    step="10"
                    className="form-input"
                    value={advForm.amount}
                    onChange={(e) => setAdvForm({ ...advForm, amount: e.target.value })}
                    required
                  />
                </div>

                <div>
                  <label className="form-label">Advance Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={advForm.advance_date}
                    onChange={(e) => setAdvForm({ ...advForm, advance_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Advance Reason / Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Festival advance, medical aid, travel expense"
                  value={advForm.notes}
                  onChange={(e) => setAdvForm({ ...advForm, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAdvanceModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn btn-primary"
                >
                  {actionLoading ? 'Recording...' : 'Record Advance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 6: RAISE DISPUTE
      ══════════════════════════════════════════════════════════════════════ */}
      {showDisputeModal && selectedJob && (
        <div className="modal-overlay" onClick={() => setShowDisputeModal(false)}>
          <div className="modal-card animate-scale-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={20} style={{ color: 'var(--danger)' }} />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                  Raise Work Dispute
                </h2>
              </div>
              <button onClick={() => setShowDisputeModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveDispute} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label">Dispute Reason *</label>
                <select
                  className="form-input"
                  value={disputeForm.reason}
                  onChange={(e) => setDisputeForm({ ...disputeForm, reason: e.target.value })}
                >
                  <option value="Attendance mismatch">Attendance mismatch</option>
                  <option value="Working hours disagreement">Working hours disagreement</option>
                  <option value="Work completion disagreement">Work completion disagreement</option>
                  <option value="Payment / Wage rate dispute">Payment / Wage rate dispute</option>
                  <option value="Break duration dispute">Break duration dispute</option>
                  <option value="Other disagreement">Other disagreement</option>
                </select>
              </div>

              <div>
                <label className="form-label">Description of Dispute *</label>
                <textarea
                  className="form-input"
                  rows="3"
                  placeholder="Explain clearly what was agreed vs what occurred..."
                  value={disputeForm.description}
                  onChange={(e) => setDisputeForm({ ...disputeForm, description: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="form-label">Evidence / Notes</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Field photos taken, witness names..."
                  value={disputeForm.evidence_text}
                  onChange={(e) => setDisputeForm({ ...disputeForm, evidence_text: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowDisputeModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn btn-danger"
                >
                  {actionLoading ? 'Submitting...' : 'Register Dispute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 7: RESOLVE DISPUTE
      ══════════════════════════════════════════════════════════════════════ */}
      {showResolveModal && selectedJob && (
        <div className="modal-overlay" onClick={() => setShowResolveModal(false)}>
          <div className="modal-card animate-scale-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <CheckCircle2 size={20} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                  Resolve Dispute
                </h2>
              </div>
              <button onClick={() => setShowResolveModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveResolve} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label className="form-label">Resolution Agreement Notes *</label>
                <textarea
                  className="form-input"
                  rows="3"
                  placeholder="e.g. Mutually agreed on 2 full days and half day deduction..."
                  value={resolveForm.resolution}
                  onChange={(e) => setResolveForm({ ...resolveForm, resolution: e.target.value })}
                  required
                />
              </div>

              <div>
                <label className="form-label">Next Job Status</label>
                <select
                  className="form-input"
                  value={resolveForm.next_status}
                  onChange={(e) => setResolveForm({ ...resolveForm, next_status: e.target.value })}
                >
                  <option value="AGREED">Agreed (Ready to resume)</option>
                  <option value="IN_PROGRESS">In Progress</option>
                  <option value="COMPLETED">Finalized & Completed</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn btn-primary"
                >
                  {actionLoading ? 'Saving...' : 'Resolve Dispute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          MODAL 8: WORKER PROFILE / HISTORY
      ══════════════════════════════════════════════════════════════════════ */}
      {showWorkerHistoryModal && (
        <div className="modal-overlay" onClick={() => setShowWorkerHistoryModal(false)}>
          <div className="modal-card animate-scale-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <User size={20} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                  Worker Profile & History
                </h2>
              </div>
              <button onClick={() => setShowWorkerHistoryModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={16} />
              </button>
            </div>

            {loadingProfile ? (
              <div style={{ textAlign: 'center', padding: '2.5rem' }}>
                <RefreshCw size={24} className="animate-spin" style={{ color: 'var(--primary)', margin: '0 auto 0.5rem' }} />
                <p>Loading worker records…</p>
              </div>
            ) : workerProfile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Worker Identity Card */}
                <div
                  style={{
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-lg)',
                    background: 'var(--surface-secondary)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)' }}>
                    Agricultural Worker
                  </div>
                  <h3 style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--text-primary)', margin: '0.2rem 0' }}>
                    {workerProfile.name}
                  </h3>
                </div>

                {/* Grid of Key Metrics */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                    gap: '0.75rem',
                  }}
                >
                  <div style={{ background: 'var(--surface-secondary)', padding: '0.75rem', borderRadius: 8 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Jobs</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-primary)' }}>{workerProfile.total_jobs}</div>
                  </div>

                  <div style={{ background: 'var(--surface-secondary)', padding: '0.75rem', borderRadius: 8 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Days</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-primary)' }}>{workerProfile.total_days}</div>
                  </div>

                  <div style={{ background: 'var(--surface-secondary)', padding: '0.75rem', borderRadius: 8 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Earned</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--primary)' }}>₹{workerProfile.total_earned.toLocaleString('en-IN')}</div>
                  </div>

                  <div style={{ background: 'var(--surface-secondary)', padding: '0.75rem', borderRadius: 8 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Paid</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--success)' }}>₹{workerProfile.total_paid.toLocaleString('en-IN')}</div>
                  </div>

                  <div style={{ background: 'var(--surface-secondary)', padding: '0.75rem', borderRadius: 8 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Advances</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--text-primary)' }}>₹{workerProfile.total_advances.toLocaleString('en-IN')}</div>
                  </div>

                  <div style={{ background: 'var(--surface-secondary)', padding: '0.75rem', borderRadius: 8 }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Pending Amount</div>
                    <div style={{ fontSize: '1.3rem', fontWeight: 900, color: workerProfile.pending_amount > 0 ? 'var(--danger)' : 'var(--success)' }}>
                      ₹{workerProfile.pending_amount.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>

                {/* Crop Breakdown */}
                {workerProfile.crop_breakdown?.length > 0 && (
                  <div>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', margin: '0 0 0.5rem 0' }}>
                      Crop Breakdown:
                    </h4>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {workerProfile.crop_breakdown.map((cb, idx) => (
                        <span
                          key={idx}
                          style={{
                            background: 'var(--surface-secondary)',
                            border: '1px solid var(--border)',
                            padding: '0.3rem 0.7rem',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.8rem',
                          }}
                        >
                          <strong>{cb.crop}:</strong> {cb.days} days • ₹{cb.earned.toLocaleString('en-IN')}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
