import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  BookOpen,
  Plus,
  TrendingDown,
  TrendingUp,
  Scale,
  Calendar,
  Search,
  Filter,
  Trash2,
  Edit3,
  Receipt,
  Camera,
  Image as ImageIcon,
  DollarSign,
  Layers,
  Sparkles,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  X,
  Eye,
  FileText,
  Clock,
  PieChart,
  BarChart3,
  RefreshCw,
  Tag,
  MapPin,
  Sprout,
  HelpCircle,
  ExternalLink
} from 'lucide-react';
import {
  getFarmDiary,
  createDiaryEntry,
  updateDiaryEntry,
  deleteDiaryEntry,
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getIncome,
  createIncome,
  updateIncome,
  deleteIncome,
  getFarmSummary,
  getPlants,
  getScannedBills
} from '../services/apiService';
import ScanBillModal from './ScanBillModal';

const ACTIVITY_TYPES = [
  'Sowing',
  'Irrigation',
  'Fertilizing',
  'Pesticide Spraying',
  'Weeding',
  'Harvesting',
  'Ploughing',
  'Labour',
  'Tractor Work',
  'Crop Inspection',
  'Other'
];

const EXPENSE_CATEGORIES = [
  'Seeds',
  'Fertilizer',
  'Pesticides',
  'Labour',
  'Tractor',
  'Irrigation',
  'Electricity',
  'Transport',
  'Equipment',
  'Other'
];

const INCOME_UNITS = [
  'kg',
  'Quintal',
  'Ton',
  'Bags',
  'Crates',
  'Bundles'
];

const COMMON_CROPS = [
  'Cotton',
  'Paddy (Rice)',
  'Chilli',
  'Maize (Corn)',
  'Red Gram (Tur)',
  'Groundnut',
  'Soybean',
  'Bengal Gram (Chana)',
  'Sugarcane',
  'Tomato',
  'Turmeric',
  'Wheat',
  'Vegetables',
  'General Farm'
];

export default function FarmDiary({ user, initialTab = 'overview' }) {
  const [activeSubTab, setActiveSubTab] = useState(initialTab);

  const [summary, setSummary] = useState(null);
  const [diaryEntries, setDiaryEntries] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [incomeList, setIncomeList] = useState([]);
  const [userCrops, setUserCrops] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCrop, setFilterCrop] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterActivity, setFilterActivity] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterSource, setFilterSource] = useState('');

  const [diaryModalOpen, setDiaryModalOpen] = useState(false);
  const [editingDiary, setEditingDiary] = useState(null);

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

  const [scanBillModalOpen, setScanBillModalOpen] = useState(false);
  const [viewReceiptModal, setViewReceiptModal] = useState(null);

  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [editingIncome, setEditingIncome] = useState(null);

  const [mediaPreview, setMediaPreview] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState(null);

  useEffect(() => {
    getPlants()
      .then((res) => {
        if (res?.success && Array.isArray(res.plants)) {
          const names = res.plants.map(p => p.crop_name).filter(Boolean);
          setUserCrops(Array.from(new Set(names)));
        }
      })
      .catch(() => {});
  }, []);

  const loadData = async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const [sumRes, diaryRes, expRes, incRes] = await Promise.all([
        getFarmSummary(),
        getFarmDiary(),
        getExpenses(),
        getIncome()
      ]);

      if (sumRes?.success) setSummary(sumRes.summary);
      if (diaryRes?.success) setDiaryEntries(diaryRes.entries || []);
      if (expRes?.success) setExpenses(expRes.expenses || []);
      if (incRes?.success) setIncomeList(incRes.income || []);
    } catch (err) {
      console.error('Failed to load farm diary data:', err);
      showToast('error', 'Could not refresh records: ' + (err.message || 'Network error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const showToast = (type, text) => {
    setStatusMessage({ type, text });
    setTimeout(() => {
      setStatusMessage(null);
    }, 4500);
  };

  const cropOptions = useMemo(() => {
    const set = new Set([...userCrops, ...COMMON_CROPS]);
    return Array.from(set);
  }, [userCrops]);

  const filteredDiary = useMemo(() => {
    return diaryEntries.filter(entry => {
      const matchCrop = !filterCrop || (entry.crop || '').toLowerCase().includes(filterCrop.toLowerCase());
      const matchActivity = !filterActivity || entry.activity_type === filterActivity;
      const matchMonth = !filterMonth || (entry.date || '').startsWith(filterMonth);
      const matchSearch = !searchQuery.trim() || [
        entry.crop,
        entry.field_name,
        entry.activity_type,
        entry.description,
        entry.notes
      ].some(val => (val || '').toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCrop && matchActivity && matchMonth && matchSearch;
    });
  }, [diaryEntries, filterCrop, filterActivity, filterMonth, searchQuery]);

  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const matchCategory = !filterCategory || exp.category === filterCategory;
      const matchCrop = !filterCrop || (exp.crop || '').toLowerCase().includes(filterCrop.toLowerCase());
      const matchMonth = !filterMonth || (exp.date || '').startsWith(filterMonth);
      const matchSource = !filterSource || (exp.receipt_source || 'MANUAL').toUpperCase() === filterSource.toUpperCase();
      const matchSearch = !searchQuery.trim() || [
        exp.category,
        exp.crop,
        exp.field_name,
        exp.description,
        exp.vendor_name,
        exp.bill_number
      ].some(val => (val || '').toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCategory && matchCrop && matchMonth && matchSource && matchSearch;
    });
  }, [expenses, filterCategory, filterCrop, filterMonth, filterSource, searchQuery]);

  const scannedExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const isScanned = (exp.receipt_source || '').toUpperCase() === 'SCANNED_RECEIPT' || exp.bill_number || exp.receipt_url;
      const matchCategory = !filterCategory || exp.category === filterCategory;
      const matchCrop = !filterCrop || (exp.crop || '').toLowerCase().includes(filterCrop.toLowerCase());
      const matchMonth = !filterMonth || (exp.date || '').startsWith(filterMonth);
      const matchSearch = !searchQuery.trim() || [
        exp.category,
        exp.crop,
        exp.field_name,
        exp.description,
        exp.vendor_name,
        exp.bill_number
      ].some(val => (val || '').toLowerCase().includes(searchQuery.toLowerCase()));
      return isScanned && matchCategory && matchCrop && matchMonth && matchSearch;
    });
  }, [expenses, filterCategory, filterCrop, filterMonth, searchQuery]);

  const filteredExpensesTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [filteredExpenses]);

  const scannedExpensesTotal = useMemo(() => {
    return scannedExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [scannedExpenses]);

  const filteredIncome = useMemo(() => {
    return incomeList.filter(inc => {
      const matchCrop = !filterCrop || (inc.crop || '').toLowerCase().includes(filterCrop.toLowerCase());
      const matchMonth = !filterMonth || (inc.date || '').startsWith(filterMonth);
      const matchSearch = !searchQuery.trim() || [
        inc.crop,
        inc.buyer_name,
        inc.notes
      ].some(val => (val || '').toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCrop && matchMonth && matchSearch;
    });
  }, [incomeList, filterCrop, filterMonth, searchQuery]);

  const filteredIncomeTotal = useMemo(() => {
    return filteredIncome.reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);
  }, [filteredIncome]);

  const confirmDeleteRecord = async () => {
    if (!deleteDialog) return;
    const { type, id } = deleteDialog;
    try {
      if (type === 'diary') {
        await deleteDiaryEntry(id);
        showToast('success', 'Diary activity entry deleted safely.');
      } else if (type === 'expense') {
        await deleteExpense(id);
        showToast('success', 'Expense record deleted safely.');
      } else if (type === 'income') {
        await deleteIncome(id);
        showToast('success', 'Income record deleted safely.');
      }
      setDeleteDialog(null);
      loadData();
    } catch (err) {
      showToast('error', err.message || 'Failed to delete record.');
    }
  };

  const formatRs = (num) => {
    const val = Number(num) || 0;
    return '₹' + val.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  };

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', paddingBottom: '4rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 38, height: 38, borderRadius: 10,
                background: 'var(--success-bg)', color: 'var(--primary)'
              }}>
                <BookOpen size={22} />
              </span>
              <h1 style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2rem)', fontWeight: 900, color: 'var(--text-primary)', margin: 0 }}>
                Farm Diary + Expenses
              </h1>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
              Record daily activities, manage farm expenses & income, and monitor seasonal cash flow.
            </p>
          </div>

          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.45rem 0.85rem', borderRadius: 8,
              border: '1px solid var(--border)', background: 'var(--surface)',
              color: 'var(--text-secondary)', fontSize: '0.8rem', fontWeight: 600,
              cursor: refreshing ? 'not-allowed' : 'pointer'
            }}
            title="Refresh Farm Records"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>{refreshing ? 'Refreshing…' : 'Sync'}</span>
          </button>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
          gap: '0.75rem',
          marginTop: '1rem'
        }}>
          <button
            onClick={() => setScanBillModalOpen(true)}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid rgba(34, 197, 94, 0.4)',
              background: 'rgba(34, 197, 94, 0.12)',
              color: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              fontWeight: 800, fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 180ms ease'
            }}
            id="btn-top-scan-bill"
          >
            <Camera size={18} />
            📷 Scan Bill
          </button>

          <button
            onClick={() => { setEditingDiary(null); setDiaryModalOpen(true); }}
            className="btn btn-primary"
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-lg)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              fontWeight: 800, fontSize: '0.9rem',
              boxShadow: 'var(--shadow-sm)'
            }}
            id="btn-add-diary"
          >
            <Plus size={18} />
            + Add Diary Entry
          </button>

          <button
            onClick={() => { setEditingExpense(null); setExpenseModalOpen(true); }}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--danger)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              fontWeight: 800, fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 180ms ease'
            }}
            id="btn-add-expense"
          >
            <TrendingDown size={18} style={{ color: 'var(--danger)' }} />
            + Add Expense
          </button>

          <button
            onClick={() => { setEditingIncome(null); setIncomeModalOpen(true); }}
            style={{
              padding: '0.75rem 1rem',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              fontWeight: 800, fontSize: '0.9rem',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'all 180ms ease'
            }}
            id="btn-add-income"
          >
            <TrendingUp size={18} style={{ color: 'var(--primary)' }} />
            + Add Income
          </button>
        </div>
      </div>

      {statusMessage && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.65rem',
          padding: '0.75rem 1rem', borderRadius: 10, marginBottom: '1.25rem',
          background: statusMessage.type === 'success' ? 'var(--success-bg)' : 'var(--danger-bg)',
          color: statusMessage.type === 'success' ? 'var(--success)' : 'var(--danger)',
          border: `1px solid ${statusMessage.type === 'success' ? 'var(--border)' : 'rgba(220,38,38,0.3)'}`,
          fontSize: '0.875rem', fontWeight: 600
        }}>
          {statusMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span style={{ flex: 1 }}>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, color: 'inherit' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      <section aria-label="Farm Financial Overview" style={{ marginBottom: '1.75rem' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: '1rem'
        }}>
          <div className="card" style={{ padding: '1.2rem', borderRadius: 'var(--radius-xl)', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                Total Expenses
              </span>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--danger-bg)', color: 'var(--danger)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <TrendingDown size={17} />
              </div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: '0.35rem' }}>
              {summary ? formatRs(summary.total_expenses) : '₹0'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {summary?.expense_count || 0} recorded farm expense{summary?.expense_count === 1 ? '' : 's'}
            </div>
          </div>

          <div className="card" style={{ padding: '1.2rem', borderRadius: 'var(--radius-xl)', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                Total Income
              </span>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--success-bg)', color: 'var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <TrendingUp size={17} />
              </div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--primary)', lineHeight: 1.1, marginBottom: '0.35rem' }}>
              {summary ? formatRs(summary.total_income) : '₹0'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {summary?.income_count || 0} harvest crop sale{summary?.income_count === 1 ? '' : 's'}
            </div>
          </div>

          <div className="card" style={{ padding: '1.2rem', borderRadius: 'var(--radius-xl)', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                Net Balance
              </span>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: (summary?.net_balance || 0) >= 0 ? 'var(--success-bg)' : 'var(--danger-bg)',
                color: (summary?.net_balance || 0) >= 0 ? 'var(--primary)' : 'var(--danger)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Scale size={17} />
              </div>
            </div>
            <div style={{
              fontSize: '1.75rem', fontWeight: 900,
              color: (summary?.net_balance || 0) >= 0 ? 'var(--primary)' : 'var(--danger)',
              lineHeight: 1, marginBottom: '0.35rem'
            }}>
              {summary ? formatRs(summary.net_balance) : '₹0'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.3 }}>
              Calculated Balance (Income − Expenses)
            </div>
          </div>

          <div className="card" style={{ padding: '1.2rem', borderRadius: 'var(--radius-xl)', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                Diary Entries
              </span>
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: 'var(--info-bg)', color: 'var(--info)',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <Calendar size={17} />
              </div>
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: '0.35rem' }}>
              {summary ? summary.diary_count : 0}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Daily farm operations logged
            </div>
          </div>
        </div>
      </section>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        overflowX: 'auto',
        paddingBottom: '0.5rem',
        marginBottom: '1.25rem',
        borderBottom: '1px solid var(--border)'
      }}>
        {[
          { id: 'overview', label: '📊 Dashboard', count: null },
          { id: 'diary', label: '📒 Diary Entries', count: diaryEntries.length },
          { id: 'expenses', label: '💰 Expenses', count: expenses.length },
          { id: 'scanned', label: '📄 Scanned Bills', count: scannedExpenses.length },
          { id: 'income', label: '💵 Income', count: incomeList.length },
          { id: 'analytics', label: '📈 Breakdown & Charts', count: null },
        ].map(tab => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.5rem 0.95rem',
                borderRadius: 10,
                border: 'none',
                background: isActive ? 'var(--primary)' : 'var(--surface)',
                color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                fontSize: '0.85rem',
                fontWeight: isActive ? 800 : 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                boxShadow: isActive ? '0 2px 8px color-mix(in srgb, var(--primary) 30%, transparent)' : 'none',
                transition: 'all 160ms ease'
              }}
            >
              <span>{tab.label}</span>
              {tab.count !== null && (
                <span style={{
                  padding: '0.1rem 0.4rem',
                  borderRadius: 12,
                  fontSize: '0.7rem',
                  fontWeight: 800,
                  background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--surface-secondary)',
                  color: isActive ? '#FFFFFF' : 'var(--text-muted)'
                }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeSubTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '0.85rem 1.1rem',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.65rem'
          }}>
            <HelpCircle size={18} style={{ color: 'var(--primary)', flexShrink: 0, marginTop: 2 }} />
            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              <strong style={{ color: 'var(--text-primary)' }}>Farm Diary Tip: </strong>
              Net Balance is an approximate reference (Income minus Expenses recorded here). Actual farm profit may be subject to unrecorded household or capital costs. Keep logging regularly for optimal seasonal planning!
            </div>
          </div>

          <div className="card" style={{ padding: '1.4rem', borderRadius: 'var(--radius-xl)', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} style={{ color: 'var(--primary)' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Recent Farm Activities & Records
                </h3>
              </div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Latest 12 events
              </span>
            </div>

            {loading ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '2rem 0' }}>
                Loading recent records…
              </p>
            ) : (!summary?.recent_activities || summary.recent_activities.length === 0) ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--text-muted)' }}>
                <BookOpen size={36} style={{ margin: '0 auto 0.5rem auto', opacity: 0.5 }} />
                <p style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>
                  No farm entries recorded yet
                </p>
                <p style={{ fontSize: '0.8rem', margin: 0 }}>
                  Start by adding your first daily diary entry, farm expense, or harvest sale!
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {summary.recent_activities.map((item, idx) => {
                  const isExp = item.type === 'expense';
                  const isInc = item.type === 'income';
                  const isDiary = item.type === 'diary';

                  return (
                    <div
                      key={item.id + '-' + item.type + '-' + idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem',
                        padding: '0.8rem 1rem',
                        borderRadius: 'var(--radius-lg)',
                        background: 'var(--surface-secondary)',
                        border: '1px solid var(--border)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', minWidth: 0 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: isExp ? 'var(--danger-bg)' : isInc ? 'var(--success-bg)' : 'var(--info-bg)',
                          color: isExp ? 'var(--danger)' : isInc ? 'var(--primary)' : 'var(--info)'
                        }}>
                          {isExp && <TrendingDown size={18} />}
                          {isInc && <TrendingUp size={18} />}
                          {isDiary && <Calendar size={18} />}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                              {item.date}
                            </span>
                            <span style={{
                              fontSize: '0.68rem', fontWeight: 800, padding: '0.1rem 0.45rem', borderRadius: 4,
                              background: isExp ? 'var(--danger-bg)' : isInc ? 'var(--success-bg)' : 'var(--info-bg)',
                              color: isExp ? 'var(--danger)' : isInc ? 'var(--primary)' : 'var(--info)',
                              textTransform: 'uppercase'
                            }}>
                              {item.type}
                            </span>
                          </div>

                          <div style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--text-primary)', marginTop: 2 }}>
                            {item.title}
                          </div>

                          {item.subtitle && (
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {item.subtitle}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        {item.amount !== undefined && (
                          <div style={{
                            fontSize: '1rem',
                            fontWeight: 900,
                            color: isExp ? 'var(--danger)' : 'var(--primary)'
                          }}>
                            {isExp ? '-' : '+'}{formatRs(item.amount)}
                          </div>
                        )}

                        {(item.photo_url || item.receipt_url) && (
                          <button
                            onClick={() => setMediaPreview({
                              url: item.photo_url || item.receipt_url,
                              title: item.title,
                              type: item.type === 'expense' ? 'Expense Receipt' : 'Farm Activity Photo'
                            })}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                              padding: '0.2rem 0.45rem', borderRadius: 6,
                              border: '1px solid var(--border)', background: 'var(--surface)',
                              fontSize: '0.7rem', fontWeight: 700, color: 'var(--primary)',
                              cursor: 'pointer', marginTop: 4
                            }}
                          >
                            <ImageIcon size={11} />
                            View Photo
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {summary?.expenses_by_category?.length > 0 && (
            <div className="card" style={{ padding: '1.4rem', borderRadius: 'var(--radius-xl)', background: 'var(--surface)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Top Expense Categories
                </h3>
                <button
                  onClick={() => setActiveSubTab('analytics')}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  View Full Breakdown →
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {summary.expenses_by_category.slice(0, 4).map((cat, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 3 }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{cat.category}</span>
                      <span style={{ fontWeight: 800, color: 'var(--text-secondary)' }}>
                        {formatRs(cat.total)} ({cat.percentage}%)
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 7, borderRadius: 10, background: 'var(--surface-secondary)', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, cat.percentage)}%`,
                        height: '100%',
                        borderRadius: 10,
                        background: 'var(--primary)'
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'diary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '1rem', borderRadius: 'var(--radius-lg)', background: 'var(--surface)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search activities, notes…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="input"
                  style={{ paddingLeft: '2rem', height: 38, fontSize: '0.825rem' }}
                />
              </div>

              <div>
                <select
                  value={filterActivity}
                  onChange={e => setFilterActivity(e.target.value)}
                  className="input"
                  style={{ height: 38, fontSize: '0.825rem' }}
                >
                  <option value="">All Activity Types</option>
                  {ACTIVITY_TYPES.map(act => (
                    <option key={act} value={act}>{act}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={filterCrop}
                  onChange={e => setFilterCrop(e.target.value)}
                  className="input"
                  style={{ height: 38, fontSize: '0.825rem' }}
                >
                  <option value="">All Crops</option>
                  {cropOptions.map(crop => (
                    <option key={crop} value={crop}>{crop}</option>
                  ))}
                </select>
              </div>

              {(searchQuery || filterActivity || filterCrop) && (
                <button
                  onClick={() => { setSearchQuery(''); setFilterActivity(''); setFilterCrop(''); }}
                  style={{
                    padding: '0.45rem 0.75rem', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--surface-secondary)',
                    fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer'
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {filteredDiary.length === 0 ? (
            <div className="card" style={{ padding: '3rem 1rem', textAlign: 'center', borderRadius: 'var(--radius-xl)', background: 'var(--surface)' }}>
              <Calendar size={40} style={{ margin: '0 auto 0.5rem auto', color: 'var(--text-muted)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>
                No diary entries found
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Record your daily field tasks, irrigation, sowing, or fertilizer applications.
              </p>
              <button
                onClick={() => { setEditingDiary(null); setDiaryModalOpen(true); }}
                className="btn btn-primary btn-sm"
              >
                <Plus size={15} /> Add First Diary Entry
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {filteredDiary.map(entry => (
                <div
                  key={entry.id}
                  className="card"
                  style={{
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-xl)',
                    background: 'var(--surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.65rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                        📅 {entry.date}
                      </span>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: 'var(--radius-full)',
                        background: 'var(--success-bg)', color: 'var(--primary)'
                      }}>
                        {entry.activity_type}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                      {entry.crop && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                          fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-primary)'
                        }}>
                          <Sprout size={13} style={{ color: 'var(--primary)' }} />
                          {entry.crop}
                        </span>
                      )}
                      {entry.field_name && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                          fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)'
                        }}>
                          <MapPin size={12} style={{ color: 'var(--text-muted)' }} />
                          {entry.field_name}
                        </span>
                      )}
                    </div>

                    {entry.description && (
                      <p style={{
                        fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.5,
                        margin: '0 0 0.5rem 0', fontWeight: 500
                      }}>
                        {entry.description}
                      </p>
                    )}

                    {entry.notes && (
                      <div style={{
                        fontSize: '0.78rem', color: 'var(--text-secondary)',
                        background: 'var(--surface-secondary)', padding: '0.45rem 0.65rem',
                        borderRadius: 8, marginBottom: '0.65rem', fontStyle: 'italic'
                      }}>
                        "{entry.notes}"
                      </div>
                    )}

                    {entry.photo_url && (
                      <div style={{ marginBottom: '0.75rem' }}>
                        <button
                          onClick={() => setMediaPreview({ url: entry.photo_url, title: entry.activity_type, type: 'Diary Photo' })}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.35rem 0.65rem', borderRadius: 8,
                            border: '1px solid var(--border)', background: 'var(--surface-secondary)',
                            fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer'
                          }}
                        >
                          <ImageIcon size={14} />
                          <span>View Photo</span>
                        </button>
                      </div>
                    )}
                  </div>

                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem',
                    borderTop: '1px solid var(--border)', paddingTop: '0.65rem', marginTop: '0.5rem'
                  }}>
                    <button
                      onClick={() => { setEditingDiary(entry); setDiaryModalOpen(true); }}
                      title="Edit Entry"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.25rem',
                        padding: '0.35rem 0.65rem', borderRadius: 6,
                        border: '1px solid var(--border)', background: 'var(--surface)',
                        color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                    <button
                      onClick={() => setDeleteDialog({ type: 'diary', id: entry.id, title: `${entry.activity_type} (${entry.date})` })}
                      title="Delete Entry"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.25rem',
                        padding: '0.35rem 0.65rem', borderRadius: 6,
                        border: '1px solid rgba(220,38,38,0.2)', background: 'var(--danger-bg)',
                        color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '1rem', borderRadius: 'var(--radius-lg)', background: 'var(--surface)' }}>
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
              gap: '0.75rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Filtered Expenses Total:
                </span>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--danger)' }}>
                  {formatRs(filteredExpensesTotal)}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setScanBillModalOpen(true)}
                  className="btn btn-primary btn-sm"
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.45rem', fontWeight: 800,
                    boxShadow: 'var(--shadow-sm)'
                  }}
                  id="btn-scan-bill-expenses-tab"
                >
                  <Camera size={15} />
                  📷 Scan Bill
                </button>
                <button
                  onClick={() => { setEditingExpense(null); setExpenseModalOpen(true); }}
                  style={{
                    padding: '0.45rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem'
                  }}
                  id="btn-add-expense-manual"
                >
                  <Plus size={14} /> + Add Expense Manually
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search vendor, bill #, items…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="input"
                  style={{ paddingLeft: '2rem', height: 38, fontSize: '0.825rem' }}
                />
              </div>

              <div>
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="input"
                  style={{ height: 38, fontSize: '0.825rem' }}
                >
                  <option value="">All Categories</option>
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={filterSource}
                  onChange={e => setFilterSource(e.target.value)}
                  className="input"
                  style={{ height: 38, fontSize: '0.825rem' }}
                >
                  <option value="">All Sources</option>
                  <option value="SCANNED_RECEIPT">📷 Scanned Bills</option>
                  <option value="MANUAL">✏️ Manual Expenses</option>
                  <option value="TRACTOR_WORK">🚜 Tractor Work</option>
                  <option value="LABOUR_WORK">👥 Labour Work</option>
                </select>
              </div>

              <div>
                <select
                  value={filterCrop}
                  onChange={e => setFilterCrop(e.target.value)}
                  className="input"
                  style={{ height: 38, fontSize: '0.825rem' }}
                >
                  <option value="">All Crops</option>
                  {cropOptions.map(crop => (
                    <option key={crop} value={crop}>{crop}</option>
                  ))}
                </select>
              </div>

              <div>
                <input
                  type="month"
                  value={filterMonth}
                  onChange={e => setFilterMonth(e.target.value)}
                  className="input"
                  style={{ height: 38, fontSize: '0.825rem' }}
                  title="Filter by Month"
                />
              </div>

              {(searchQuery || filterCategory || filterCrop || filterMonth || filterSource) && (
                <button
                  onClick={() => { setSearchQuery(''); setFilterCategory(''); setFilterCrop(''); setFilterMonth(''); setFilterSource(''); }}
                  style={{
                    padding: '0.45rem 0.75rem', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--surface-secondary)',
                    fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer'
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="card" style={{ padding: '3rem 1rem', textAlign: 'center', borderRadius: 'var(--radius-xl)', background: 'var(--surface)' }}>
              <Receipt size={40} style={{ margin: '0 auto 0.5rem auto', color: 'var(--text-muted)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>
                No expenses found
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                Scan a fertilizer or seeds bill with your phone camera, or enter an expense manually.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setScanBillModalOpen(true)}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 800 }}
                >
                  <Camera size={15} /> 📷 Scan Bill
                </button>
                <button
                  onClick={() => { setEditingExpense(null); setExpenseModalOpen(true); }}
                  className="btn btn-secondary btn-sm"
                >
                  <Plus size={15} /> + Add Manually
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {filteredExpenses.map(exp => {
                const isScanned = (exp.receipt_source || '').toUpperCase() === 'SCANNED_RECEIPT';
                const hasReceipt = Boolean(exp.receipt_url);
                const itemCount = exp.extracted_details?.items?.length || 0;

                return (
                  <div
                    key={exp.id}
                    className="card"
                    style={{
                      padding: '1.25rem',
                      borderRadius: 'var(--radius-xl)',
                      background: 'var(--surface)',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      border: isScanned ? '1px solid rgba(34, 197, 94, 0.35)' : '1px solid var(--border)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                          📅 {exp.date}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          {isScanned && (
                            <span style={{
                              fontSize: '0.68rem', fontWeight: 800, padding: '0.15rem 0.45rem', borderRadius: 6,
                              background: 'rgba(34, 197, 94, 0.15)', color: 'var(--primary)',
                              display: 'inline-flex', alignItems: 'center', gap: 3
                            }}>
                              <Camera size={10} /> SCANNED
                            </span>
                          )}
                          <span style={{
                            fontSize: '0.72rem', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: 'var(--radius-full)',
                            background: 'var(--danger-bg)', color: 'var(--danger)'
                          }}>
                            {exp.category}
                          </span>
                        </div>
                      </div>

                      <div style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.35rem', lineHeight: 1.1 }}>
                        {formatRs(exp.amount)}
                      </div>

                      {/* Vendor & Bill # badge if available */}
                      {(exp.vendor_name || exp.bill_number) && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '0.45rem',
                          background: 'var(--surface-secondary)', padding: '0.35rem 0.55rem',
                          borderRadius: 6, marginBottom: '0.5rem', fontSize: '0.75rem', flexWrap: 'wrap'
                        }}>
                          {exp.vendor_name && (
                            <span style={{ fontWeight: 700, color: 'var(--text-primary)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              <Store size={12} style={{ color: 'var(--primary)' }} />
                              {exp.vendor_name}
                            </span>
                          )}
                          {exp.bill_number && (
                            <span style={{ color: 'var(--text-muted)' }}>
                              #{exp.bill_number}
                            </span>
                          )}
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                        {exp.crop && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                            fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)'
                          }}>
                            <Sprout size={13} style={{ color: 'var(--primary)' }} />
                            {exp.crop}
                          </span>
                        )}
                        {exp.field_name && (
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                            fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)'
                          }}>
                            <MapPin size={12} />
                            {exp.field_name}
                          </span>
                        )}
                      </div>

                      {exp.description && (
                        <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', lineHeight: 1.45, margin: '0 0 0.65rem 0' }}>
                          {exp.description}
                        </p>
                      )}

                      {/* Receipt View Button */}
                      {hasReceipt && (
                        <div style={{ marginBottom: '0.65rem' }}>
                          <button
                            onClick={() => setViewReceiptModal(exp)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                              padding: '0.35rem 0.65rem', borderRadius: 8,
                              border: '1px solid rgba(34, 197, 94, 0.4)', background: 'rgba(34, 197, 94, 0.08)',
                              fontSize: '0.75rem', fontWeight: 800, color: 'var(--primary)', cursor: 'pointer'
                            }}
                          >
                            <Receipt size={13} />
                            <span>View Bill & Items {itemCount > 0 ? `(${itemCount})` : ''}</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem',
                      borderTop: '1px solid var(--border)', paddingTop: '0.65rem', marginTop: '0.5rem'
                    }}>
                      <button
                        onClick={() => { setEditingExpense(exp); setExpenseModalOpen(true); }}
                        title="Edit Expense"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.25rem',
                          padding: '0.35rem 0.65rem', borderRadius: 6,
                          border: '1px solid var(--border)', background: 'var(--surface)',
                          color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        <Edit3 size={13} /> Edit
                      </button>
                      <button
                        onClick={() => setDeleteDialog({ type: 'expense', id: exp.id, title: `${exp.category} (${formatRs(exp.amount)})` })}
                        title="Delete Expense"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.25rem',
                          padding: '0.35rem 0.65rem', borderRadius: 6,
                          border: '1px solid rgba(220,38,38,0.2)', background: 'var(--danger-bg)',
                          color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* DEDICATED SCANNED BILLS DASHBOARD TAB */}
      {activeSubTab === 'scanned' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '1.25rem', borderRadius: 'var(--radius-xl)', background: 'var(--surface)' }}>
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
              gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1rem'
            }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: 8,
                    background: 'rgba(34, 197, 94, 0.15)', color: 'var(--primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center'
                  }}>
                    <Camera size={18} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                    Scanned Farming Bills
                  </h3>
                </div>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  All invoices and store receipts scanned with Farmer AI ({scannedExpenses.length} bills • Total: {formatRs(scannedExpensesTotal)})
                </p>
              </div>

              <button
                onClick={() => setScanBillModalOpen(true)}
                className="btn btn-primary"
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800,
                  padding: '0.65rem 1.25rem', fontSize: '0.9rem'
                }}
                id="btn-scan-bill-scanned-tab"
              >
                <Camera size={18} />
                📷 Scan New Bill
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search vendor, bill #…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="input"
                  style={{ paddingLeft: '2rem', height: 38, fontSize: '0.825rem' }}
                />
              </div>

              <div>
                <select
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                  className="input"
                  style={{ height: 38, fontSize: '0.825rem' }}
                >
                  <option value="">All Categories</option>
                  {EXPENSE_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={filterCrop}
                  onChange={e => setFilterCrop(e.target.value)}
                  className="input"
                  style={{ height: 38, fontSize: '0.825rem' }}
                >
                  <option value="">All Crops</option>
                  {cropOptions.map(crop => (
                    <option key={crop} value={crop}>{crop}</option>
                  ))}
                </select>
              </div>

              <div>
                <input
                  type="month"
                  value={filterMonth}
                  onChange={e => setFilterMonth(e.target.value)}
                  className="input"
                  style={{ height: 38, fontSize: '0.825rem' }}
                  title="Filter by Month"
                />
              </div>
            </div>

            {scannedExpenses.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                <FileText size={42} style={{ margin: '0 auto 0.5rem auto', opacity: 0.4 }} />
                <h4 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>
                  No scanned bills found
                </h4>
                <p style={{ fontSize: '0.85rem', maxWidth: 360, margin: '0 auto 1.25rem auto' }}>
                  Take a photo of your fertilizer, pesticide, seed, or tractor receipt and Farmer AI will extract and organize it.
                </p>
                <button
                  onClick={() => setScanBillModalOpen(true)}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Camera size={16} /> Scan Your First Bill
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1rem' }}>
                {scannedExpenses.map(exp => (
                  <div
                    key={exp.id}
                    style={{
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--surface-secondary)',
                      padding: '1.1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      gap: '0.75rem'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                        <div>
                          <div style={{ fontWeight: 900, fontSize: '1rem', color: 'var(--text-primary)' }}>
                            {exp.vendor_name || exp.category || 'Farming Vendor'}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {exp.date} {exp.bill_number ? `• Bill #${exp.bill_number}` : ''}
                          </div>
                        </div>
                        <span style={{
                          fontSize: '0.7rem', fontWeight: 800, padding: '0.15rem 0.5rem', borderRadius: 6,
                          background: 'rgba(34, 197, 94, 0.15)', color: 'var(--primary)', textTransform: 'uppercase'
                        }}>
                          {exp.category}
                        </span>
                      </div>

                      <div style={{ fontSize: '1.5rem', fontWeight: 900, color: 'var(--danger)', margin: '0.35rem 0' }}>
                        {formatRs(exp.amount)}
                      </div>

                      {exp.extracted_details?.items?.length > 0 && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                          <strong>Items: </strong>
                          {exp.extracted_details.items.map(it => it.name).filter(Boolean).slice(0, 3).join(', ')}
                          {exp.extracted_details.items.length > 3 ? ` (+${exp.extracted_details.items.length - 3} more)` : ''}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '0.65rem' }}>
                      <button
                        onClick={() => setViewReceiptModal(exp)}
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                      >
                        <Eye size={13} /> View Receipt
                      </button>

                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button
                          onClick={() => { setEditingExpense(exp); setExpenseModalOpen(true); }}
                          style={{
                            padding: '0.3rem 0.6rem', borderRadius: 6,
                            border: '1px solid var(--border)', background: 'var(--surface)',
                            fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', color: 'var(--text-secondary)'
                          }}
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteDialog({ type: 'expense', id: exp.id, title: `${exp.vendor_name || exp.category} (${formatRs(exp.amount)})` })}
                          style={{
                            padding: '0.3rem 0.6rem', borderRadius: 6,
                            border: '1px solid rgba(220,38,38,0.2)', background: 'var(--danger-bg)',
                            fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', color: 'var(--danger)'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'income' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="card" style={{ padding: '1rem', borderRadius: 'var(--radius-lg)', background: 'var(--surface)' }}>
            <div style={{
              display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
              gap: '0.75rem', marginBottom: '0.75rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                  Filtered Income Total:
                </span>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: 'var(--primary)' }}>
                  {formatRs(filteredIncomeTotal)}
                </div>
              </div>

              <button
                onClick={() => { setEditingIncome(null); setIncomeModalOpen(true); }}
                className="btn btn-primary btn-sm"
              >
                <Plus size={15} /> Add Harvest Income
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search buyer, crop, notes…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="input"
                  style={{ paddingLeft: '2rem', height: 38, fontSize: '0.825rem' }}
                />
              </div>

              <div>
                <select
                  value={filterCrop}
                  onChange={e => setFilterCrop(e.target.value)}
                  className="input"
                  style={{ height: 38, fontSize: '0.825rem' }}
                >
                  <option value="">All Crops</option>
                  {cropOptions.map(crop => (
                    <option key={crop} value={crop}>{crop}</option>
                  ))}
                </select>
              </div>

              <div>
                <input
                  type="month"
                  value={filterMonth}
                  onChange={e => setFilterMonth(e.target.value)}
                  className="input"
                  style={{ height: 38, fontSize: '0.825rem' }}
                  title="Filter by Month"
                />
              </div>

              {(searchQuery || filterCrop || filterMonth) && (
                <button
                  onClick={() => { setSearchQuery(''); setFilterCrop(''); setFilterMonth(''); }}
                  style={{
                    padding: '0.45rem 0.75rem', borderRadius: 8,
                    border: '1px solid var(--border)', background: 'var(--surface-secondary)',
                    fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer'
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>

          {filteredIncome.length === 0 ? (
            <div className="card" style={{ padding: '3rem 1rem', textAlign: 'center', borderRadius: 'var(--radius-xl)', background: 'var(--surface)' }}>
              <TrendingUp size={40} style={{ margin: '0 auto 0.5rem auto', color: 'var(--text-muted)' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.25rem 0' }}>
                No crop sales or income logged yet
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Record your harvest sales, quantity, selling prices, and buyer details.
              </p>
              <button
                onClick={() => { setEditingIncome(null); setIncomeModalOpen(true); }}
                className="btn btn-primary btn-sm"
              >
                <Plus size={15} /> Add First Income Record
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1rem' }}>
              {filteredIncome.map(inc => (
                <div
                  key={inc.id}
                  className="card"
                  style={{
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-xl)',
                    background: 'var(--surface)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.5rem' }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)' }}>
                        {inc.date}
                      </span>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: 'var(--radius-full)',
                        background: 'var(--success-bg)', color: 'var(--primary)'
                      }}>
                        🌾 {inc.crop}
                      </span>
                    </div>

                    <div style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--primary)', marginBottom: '0.35rem', lineHeight: 1.1 }}>
                      {formatRs(inc.total_amount)}
                    </div>

                    <div style={{
                      fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)',
                      marginBottom: '0.45rem', background: 'var(--surface-secondary)', padding: '0.4rem 0.65rem',
                      borderRadius: 8
                    }}>
                      <span>{inc.quantity} {inc.unit}</span>
                      <span style={{ color: 'var(--text-muted)', margin: '0 0.35rem' }}>×</span>
                      <span>₹{inc.selling_price}/{inc.unit}</span>
                    </div>

                    {inc.buyer_name && (
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: '0.35rem' }}>
                        <strong>Buyer: </strong> {inc.buyer_name}
                      </div>
                    )}

                    {inc.notes && (
                      <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: 1.4, margin: '0 0 0.5rem 0', fontStyle: 'italic' }}>
                        "{inc.notes}"
                      </p>
                    )}
                  </div>

                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.5rem',
                    borderTop: '1px solid var(--border)', paddingTop: '0.65rem', marginTop: '0.5rem'
                  }}>
                    <button
                      onClick={() => { setEditingIncome(inc); setIncomeModalOpen(true); }}
                      title="Edit Income"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.25rem',
                        padding: '0.35rem 0.65rem', borderRadius: 6,
                        border: '1px solid var(--border)', background: 'var(--surface)',
                        color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                    <button
                      onClick={() => setDeleteDialog({ type: 'income', id: inc.id, title: `Sold ${inc.crop} (${formatRs(inc.total_amount)})` })}
                      title="Delete Income"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.25rem',
                        padding: '0.35rem 0.65rem', borderRadius: 6,
                        border: '1px solid rgba(220,38,38,0.2)', background: 'var(--danger-bg)',
                        color: 'var(--danger)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={13} /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeSubTab === 'analytics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-xl)', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <PieChart size={20} style={{ color: 'var(--primary)' }} />
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Expenses by Category
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Where your farm operating funds are spent
                </span>
              </div>
            </div>

            {(!summary?.expenses_by_category || summary.expenses_by_category.length === 0) ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>
                No category expense data available yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {summary.expenses_by_category.map((cat, idx) => (
                  <div key={idx}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                        {cat.category} ({cat.count} record{cat.count === 1 ? '' : 's'})
                      </span>
                      <span style={{ fontWeight: 900, color: 'var(--text-primary)' }}>
                        {formatRs(cat.total)} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>({cat.percentage}%)</span>
                      </span>
                    </div>
                    <div style={{ width: '100%', height: 10, borderRadius: 10, background: 'var(--surface-secondary)', overflow: 'hidden' }}>
                      <div style={{
                        width: `${Math.min(100, cat.percentage)}%`,
                        height: '100%',
                        borderRadius: 10,
                        background: idx === 0 ? 'var(--primary)' : idx === 1 ? '#D8893D' : idx === 2 ? '#0284C7' : '#7B8C80'
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-xl)', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <Sprout size={20} style={{ color: 'var(--primary)' }} />
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Expenses by Crop
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Total investment per individual crop
                </span>
              </div>
            </div>

            {(!summary?.expenses_by_crop || summary.expenses_by_crop.length === 0) ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>
                No crop expense records available yet.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
                {summary.expenses_by_crop.map((c, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-lg)',
                      background: 'var(--surface-secondary)',
                      border: '1px solid var(--border)'
                    }}
                  >
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 2 }}>
                      {c.crop}
                    </div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 900, color: 'var(--text-primary)' }}>
                      {formatRs(c.total)}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                      {c.count} expense entry{c.count === 1 ? '' : 'ies'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: '1.5rem', borderRadius: 'var(--radius-xl)', background: 'var(--surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
              <BarChart3 size={20} style={{ color: 'var(--primary)' }} />
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                  Monthly Cash Flow
                </h3>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Expenses vs Income across months
                </span>
              </div>
            </div>

            {(!summary?.expenses_by_month?.length && !summary?.income_by_month?.length) ? (
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>
                No monthly timeline data recorded yet.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {Array.from(new Set([
                  ...(summary?.expenses_by_month || []).map(m => m.month),
                  ...(summary?.income_by_month || []).map(m => m.month)
                ])).sort().reverse().map(month => {
                  const mExp = summary?.expenses_by_month?.find(m => m.month === month)?.total || 0;
                  const mInc = summary?.income_by_month?.find(m => m.month === month)?.total || 0;
                  const mBal = mInc - mExp;

                  return (
                    <div
                      key={month}
                      style={{
                        padding: '1rem',
                        borderRadius: 'var(--radius-lg)',
                        background: 'var(--surface-secondary)',
                        border: '1px solid var(--border)',
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '0.75rem'
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                          📅 {month}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexWrap: 'wrap' }}>
                        <div>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Expenses
                          </div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--danger)' }}>
                            {formatRs(mExp)}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Income
                          </div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--primary)' }}>
                            {formatRs(mInc)}
                          </div>
                        </div>

                        <div>
                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                            Net
                          </div>
                          <div style={{
                            fontSize: '0.95rem', fontWeight: 900,
                            color: mBal >= 0 ? 'var(--primary)' : 'var(--danger)'
                          }}>
                            {mBal >= 0 ? '+' : ''}{formatRs(mBal)}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {diaryModalOpen && (
        <DiaryEntryModal
          entry={editingDiary}
          cropOptions={cropOptions}
          onClose={() => setDiaryModalOpen(false)}
          onSaved={() => {
            setDiaryModalOpen(false);
            showToast('success', editingDiary ? 'Diary entry updated.' : 'Diary entry created.');
            loadData();
          }}
        />
      )}

      {expenseModalOpen && (
        <ExpenseModal
          expense={editingExpense}
          cropOptions={cropOptions}
          onClose={() => setExpenseModalOpen(false)}
          onSaved={() => {
            setExpenseModalOpen(false);
            showToast('success', editingExpense ? 'Expense updated.' : 'Expense recorded.');
            loadData();
          }}
        />
      )}

      {incomeModalOpen && (
        <IncomeModal
          income={editingIncome}
          cropOptions={cropOptions}
          onClose={() => setIncomeModalOpen(false)}
          onSaved={() => {
            setIncomeModalOpen(false);
            showToast('success', editingIncome ? 'Income record updated.' : 'Income recorded.');
            loadData();
          }}
        />
      )}

      {scanBillModalOpen && (
        <ScanBillModal
          isOpen={scanBillModalOpen}
          existingCrops={cropOptions}
          onClose={() => setScanBillModalOpen(false)}
          onBillSaved={(savedExpense) => {
            setScanBillModalOpen(false);
            showToast('success', `Bill ${savedExpense?.bill_number ? '#' + savedExpense.bill_number : ''} saved to expenses!`);
            loadData();
          }}
        />
      )}

      {viewReceiptModal && (
        <ViewReceiptModal
          expense={viewReceiptModal}
          onClose={() => setViewReceiptModal(null)}
          onEdit={(exp) => {
            setViewReceiptModal(null);
            setEditingExpense(exp);
            setExpenseModalOpen(true);
          }}
        />
      )}

      {mediaPreview && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            maxWidth: 640, width: '100%', background: 'var(--surface)',
            borderRadius: 'var(--radius-xl)', overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column'
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)'
            }}>
              <div>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--primary)' }}>
                  {mediaPreview.type}
                </span>
                <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {mediaPreview.title}
                </h4>
              </div>
              <button
                onClick={() => setMediaPreview(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: '75vh', overflow: 'auto' }}>
              <img
                src={mediaPreview.url}
                alt={mediaPreview.title}
                style={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: 8 }}
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.parentElement.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Preview not available or file is a PDF.</p>';
                }}
              />
            </div>

            <div style={{
              padding: '0.75rem 1.25rem', borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <a
                href={mediaPreview.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                  fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)', textDecoration: 'none'
                }}
              >
                <ExternalLink size={14} /> Open in Full Tab
              </a>
              <button
                onClick={() => setMediaPreview(null)}
                className="btn btn-secondary btn-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteDialog && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div style={{
            maxWidth: 420, width: '100%', background: 'var(--surface)',
            borderRadius: 'var(--radius-xl)', padding: '1.5rem',
            boxShadow: 'var(--shadow-lg)'
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'var(--danger-bg)', color: 'var(--danger)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <Trash2 size={24} />
            </div>

            <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 0.5rem 0' }}>
              Confirm Deletion
            </h3>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 1.25rem 0' }}>
              Are you sure you want to delete this {deleteDialog.type}?
              <br />
              <strong style={{ color: 'var(--text-primary)' }}>"{deleteDialog.title}"</strong>
              <br />
              This record will be permanently removed from your farm database.
            </p>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setDeleteDialog(null)}
                className="btn btn-secondary"
                style={{ padding: '0.5rem 1.1rem', fontSize: '0.85rem' }}
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteRecord}
                style={{
                  padding: '0.5rem 1.1rem', borderRadius: 8,
                  border: 'none', background: 'var(--danger)', color: '#FFFFFF',
                  fontSize: '0.85rem', fontWeight: 800, cursor: 'pointer'
                }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DiaryEntryModal({ entry, cropOptions, onClose, onSaved }) {
  const isEditing = Boolean(entry);
  const [date, setDate] = useState(entry?.date || new Date().toISOString().split('T')[0]);
  const [crop, setCrop] = useState(entry?.crop || '');
  const [fieldName, setFieldName] = useState(entry?.field_name || '');
  const [activityType, setActivityType] = useState(entry?.activity_type || 'Fertilizing');
  const [description, setDescription] = useState(entry?.description || '');
  const [notes, setNotes] = useState(entry?.notes || '');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(entry?.photo_url || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Photo size exceeds 10MB limit.');
        return;
      }
      setPhotoFile(file);
      setPhotoPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!date) {
      setError('Please select a date.');
      return;
    }
    if (!activityType) {
      setError('Please select an activity type.');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('date', date);
      formData.append('crop', crop);
      formData.append('field_name', fieldName);
      formData.append('activity_type', activityType);
      formData.append('description', description);
      formData.append('notes', notes);
      if (photoFile) {
        formData.append('photo', photoFile);
      }

      if (isEditing) {
        await updateDiaryEntry(entry.id, formData);
      } else {
        await createDiaryEntry(formData);
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save diary entry.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        maxWidth: 540, width: '100%', background: 'var(--surface)',
        borderRadius: 'var(--radius-xl)', overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>📒</span>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {isEditing ? 'Edit Diary Entry' : 'New Farm Diary Entry'}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {error && (
            <div style={{
              background: 'var(--danger-bg)', color: 'var(--danger)',
              padding: '0.65rem 0.85rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="input"
                style={{ height: 40 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Activity Type *
              </label>
              <select
                required
                value={activityType}
                onChange={e => setActivityType(e.target.value)}
                className="input"
                style={{ height: 40 }}
              >
                {ACTIVITY_TYPES.map(act => (
                  <option key={act} value={act}>{act}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Crop
              </label>
              <input
                list="crop-list-diary"
                type="text"
                placeholder="e.g. Cotton, Paddy"
                value={crop}
                onChange={e => setCrop(e.target.value)}
                className="input"
                style={{ height: 40 }}
              />
              <datalist id="crop-list-diary">
                {cropOptions.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Field / Farm Name
              </label>
              <input
                type="text"
                placeholder="e.g. Main Field, North Acre"
                value={fieldName}
                onChange={e => setFieldName(e.target.value)}
                className="input"
                style={{ height: 40 }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Activity Description
            </label>
            <textarea
              rows={2}
              placeholder="What work was done today? (e.g. Sprayed neem oil on cotton leaves)"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="input"
              style={{ resize: 'vertical' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Observation & Notes
            </label>
            <input
              type="text"
              placeholder="e.g. Plants growing healthy, soil moisture normal"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input"
              style={{ height: 40 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Attach Field Photo (Optional)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              style={{ display: 'none' }}
            />

            {photoPreview ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--surface-secondary)', padding: '0.5rem', borderRadius: 8 }}>
                <img src={photoPreview} alt="Preview" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', flex: 1 }}>Photo selected</span>
                <button
                  type="button"
                  onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%', padding: '0.65rem', borderRadius: 8,
                  border: '1px dashed var(--border)', background: 'var(--surface-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer'
                }}
              >
                <Camera size={16} /> Take or Select Photo
              </button>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn btn-secondary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: 800 }}
            >
              {saving ? 'Saving…' : isEditing ? 'Update Entry' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ExpenseModal({ expense, cropOptions, onClose, onSaved }) {
  const isEditing = Boolean(expense);
  const [date, setDate] = useState(expense?.date || new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState(expense?.category || 'Fertilizer');
  const [amount, setAmount] = useState(expense?.amount !== undefined ? String(expense.amount) : '');
  const [crop, setCrop] = useState(expense?.crop || '');
  const [fieldName, setFieldName] = useState(expense?.field_name || '');
  const [description, setDescription] = useState(expense?.description || '');
  const [vendorName, setVendorName] = useState(expense?.vendor_name || '');
  const [billNumber, setBillNumber] = useState(expense?.bill_number || '');
  const [vendorPhone, setVendorPhone] = useState(expense?.vendor_phone || '');
  const [tax, setTax] = useState(expense?.tax !== undefined && expense?.tax !== null ? String(expense.tax) : '');
  const [discount, setDiscount] = useState(expense?.discount !== undefined && expense?.discount !== null ? String(expense.discount) : '');
  const [paymentMethod, setPaymentMethod] = useState(expense?.payment_method || 'Cash');
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(expense?.receipt_url || null);
  const [showAdvanced, setShowAdvanced] = useState(Boolean(expense?.vendor_name || expense?.bill_number || expense?.tax));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const fileInputRef = useRef(null);

  const handleReceiptChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        setError('Receipt file size exceeds 10MB limit.');
        return;
      }
      setReceiptFile(file);
      setReceiptPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!date) {
      setError('Please specify the expense date.');
      return;
    }
    if (!category) {
      setError('Please select an expense category.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      setError('Amount cannot be negative and must be a valid number.');
      return;
    }

    setSaving(true);
    try {
      const formData = new FormData();
      formData.append('date', date);
      formData.append('category', category);
      formData.append('amount', numAmount);
      formData.append('crop', crop);
      formData.append('field_name', fieldName);
      formData.append('description', description);
      formData.append('vendor_name', vendorName);
      formData.append('bill_number', billNumber);
      formData.append('vendor_phone', vendorPhone);
      if (tax) formData.append('tax', tax);
      if (discount) formData.append('discount', discount);
      if (paymentMethod) formData.append('payment_method', paymentMethod);

      if (receiptFile) {
        formData.append('receipt', receiptFile);
      }

      if (isEditing) {
        await updateExpense(expense.id, formData);
      } else {
        await createExpense(formData);
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save expense record.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        maxWidth: 540, width: '100%', background: 'var(--surface)',
        borderRadius: 'var(--radius-xl)', overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>💰</span>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {isEditing ? 'Edit Expense Record' : 'Record Farm Expense'}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {error && (
            <div style={{
              background: 'var(--danger-bg)', color: 'var(--danger)',
              padding: '0.65rem 0.85rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Amount (₹) *
              </label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 10, top: 10, fontWeight: 900, color: 'var(--text-muted)' }}>₹</span>
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  placeholder="2500"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="input"
                  style={{ height: 40, paddingLeft: '1.8rem', fontWeight: 800, fontSize: '1.05rem' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="input"
                style={{ height: 40 }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Expense Category *
            </label>
            <select
              required
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="input"
              style={{ height: 40 }}
            >
              {EXPENSE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Crop (Optional)
              </label>
              <input
                list="crop-list-expense"
                type="text"
                placeholder="e.g. Cotton, General"
                value={crop}
                onChange={e => setCrop(e.target.value)}
                className="input"
                style={{ height: 40 }}
              />
              <datalist id="crop-list-expense">
                {cropOptions.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Field Name (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Main Plot"
                value={fieldName}
                onChange={e => setFieldName(e.target.value)}
                className="input"
                style={{ height: 40 }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Description
            </label>
            <input
              type="text"
              placeholder="e.g. Purchased 2 bags DAP from cooperative store"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="input"
              style={{ height: 40 }}
            />
          </div>

          {/* Optional Bill / Vendor Info Toggle */}
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                background: 'none', border: 'none', padding: 0,
                color: 'var(--primary)', fontSize: '0.78rem', fontWeight: 700,
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem'
              }}
            >
              <span>{showAdvanced ? '− Hide Vendor & Bill Details' : '+ Add Vendor & Bill Details (Optional)'}</span>
            </button>

            {showAdvanced && (
              <div style={{
                marginTop: '0.6rem', padding: '0.85rem',
                borderRadius: 10, background: 'var(--surface-secondary)',
                border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.65rem'
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 3 }}>
                      Vendor / Shop Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Kisan Agro Center"
                      value={vendorName}
                      onChange={e => setVendorName(e.target.value)}
                      className="input"
                      style={{ height: 36, fontSize: '0.82rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 3 }}>
                      Bill / Invoice #
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. INV-2026-081"
                      value={billNumber}
                      onChange={e => setBillNumber(e.target.value)}
                      className="input"
                      style={{ height: 36, fontSize: '0.82rem' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 3 }}>
                      Tax (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={tax}
                      onChange={e => setTax(e.target.value)}
                      className="input"
                      style={{ height: 36, fontSize: '0.82rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 3 }}>
                      Discount (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="0.00"
                      value={discount}
                      onChange={e => setDiscount(e.target.value)}
                      className="input"
                      style={{ height: 36, fontSize: '0.82rem' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 3 }}>
                      Payment Mode
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      className="input"
                      style={{ height: 36, fontSize: '0.82rem' }}
                    >
                      <option value="Cash">Cash</option>
                      <option value="UPI">UPI / GPay / PhonePe</option>
                      <option value="Credit / Khata">Credit / Khata</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Card">Card</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Receipt / Bill Photo (Optional)
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*,application/pdf"
              capture="environment"
              onChange={handleReceiptChange}
              style={{ display: 'none' }}
            />

            {receiptPreview ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'var(--surface-secondary)', padding: '0.5rem', borderRadius: 8 }}>
                <img src={receiptPreview} alt="Receipt" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 6 }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', flex: 1 }}>Receipt attached</span>
                <button
                  type="button"
                  onClick={() => { setReceiptFile(null); setReceiptPreview(null); }}
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%', padding: '0.65rem', borderRadius: 8,
                  border: '1px dashed var(--border)', background: 'var(--surface-secondary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer'
                }}
              >
                <Receipt size={16} /> Upload Bill / Receipt
              </button>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn btn-secondary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: 800 }}
            >
              {saving ? 'Saving…' : isEditing ? 'Update Expense' : 'Save Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IncomeModal({ income, cropOptions, onClose, onSaved }) {
  const isEditing = Boolean(income);
  const [date, setDate] = useState(income?.date || new Date().toISOString().split('T')[0]);
  const [crop, setCrop] = useState(income?.crop || 'Cotton');
  const [quantity, setQuantity] = useState(income?.quantity !== undefined ? String(income.quantity) : '');
  const [unit, setUnit] = useState(income?.unit || 'kg');
  const [sellingPrice, setSellingPrice] = useState(income?.selling_price !== undefined ? String(income.selling_price) : '');
  const [totalAmount, setTotalAmount] = useState(income?.total_amount !== undefined ? String(income.total_amount) : '');
  const [customTotalEdited, setCustomTotalEdited] = useState(false);
  const [buyerName, setBuyerName] = useState(income?.buyer_name || '');
  const [notes, setNotes] = useState(income?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!customTotalEdited) {
      const q = parseFloat(quantity) || 0;
      const p = parseFloat(sellingPrice) || 0;
      if (q > 0 && p > 0) {
        setTotalAmount(String(Math.round(q * p * 100) / 100));
      }
    }
  }, [quantity, sellingPrice, customTotalEdited]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!date) {
      setError('Date is required.');
      return;
    }
    if (!crop.trim()) {
      setError('Crop name is required.');
      return;
    }

    const q = parseFloat(quantity);
    if (isNaN(q) || q <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }

    const p = parseFloat(sellingPrice);
    if (isNaN(p) || p < 0) {
      setError('Selling price cannot be negative.');
      return;
    }

    const total = parseFloat(totalAmount);
    if (isNaN(total) || total < 0) {
      setError('Total income amount cannot be negative.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        date,
        crop: crop.trim(),
        quantity: q,
        unit,
        selling_price: p,
        total_amount: total,
        buyer_name: buyerName.trim(),
        notes: notes.trim()
      };

      if (isEditing) {
        await updateIncome(income.id, payload);
      } else {
        await createIncome(payload);
      }
      onSaved();
    } catch (err) {
      setError(err.message || 'Failed to save income record.');
    } finally {
      setSaving(false);
    }
  };

  const calculatedPreview = (parseFloat(quantity) || 0) * (parseFloat(sellingPrice) || 0);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(5px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        maxWidth: 520, width: '100%', background: 'var(--surface)',
        borderRadius: 'var(--radius-xl)', overflow: 'hidden',
        boxShadow: 'var(--shadow-lg)', maxHeight: '90vh', display: 'flex', flexDirection: 'column'
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '1.2rem' }}>💵</span>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {isEditing ? 'Edit Income Record' : 'Record Crop Income / Sale'}
            </h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.9rem' }}>
          {error && (
            <div style={{
              background: 'var(--danger-bg)', color: 'var(--danger)',
              padding: '0.65rem 0.85rem', borderRadius: 8, fontSize: '0.8rem', fontWeight: 600
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Date *
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={e => setDate(e.target.value)}
                className="input"
                style={{ height: 40 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Crop Sold *
              </label>
              <input
                list="crop-list-income"
                type="text"
                required
                placeholder="e.g. Cotton"
                value={crop}
                onChange={e => setCrop(e.target.value)}
                className="input"
                style={{ height: 40 }}
              />
              <datalist id="crop-list-income">
                {cropOptions.map(c => <option key={c} value={c} />)}
              </datalist>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1.2fr', gap: '0.6rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Quantity *
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                required
                placeholder="500"
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
                className="input"
                style={{ height: 40, fontWeight: 700 }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Unit
              </label>
              <select
                value={unit}
                onChange={e => setUnit(e.target.value)}
                className="input"
                style={{ height: 40 }}
              >
                {INCOME_UNITS.map(u => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                Price / {unit} (₹) *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                placeholder="70"
                value={sellingPrice}
                onChange={e => setSellingPrice(e.target.value)}
                className="input"
                style={{ height: 40, fontWeight: 700 }}
              />
            </div>
          </div>

          <div style={{
            background: 'var(--surface-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 10,
            padding: '0.85rem 1rem'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <label style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Total Income Amount (₹)
              </label>
              <span style={{ fontSize: '0.72rem', color: 'var(--primary)', fontWeight: 700 }}>
                {quantity && sellingPrice ? `Formula: ${quantity} × ₹${sellingPrice} = ₹${calculatedPreview}` : 'Auto-calculated'}
              </span>
            </div>

            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 10, top: 10, fontWeight: 900, color: 'var(--primary)' }}>₹</span>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={totalAmount}
                onChange={e => {
                  setTotalAmount(e.target.value);
                  setCustomTotalEdited(true);
                }}
                className="input"
                style={{
                  height: 42,
                  paddingLeft: '1.8rem',
                  fontSize: '1.15rem',
                  fontWeight: 900,
                  color: 'var(--primary)',
                  background: 'var(--surface)'
                }}
              />
            </div>
            {customTotalEdited && (
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>Custom total entered</span>
                <button
                  type="button"
                  onClick={() => {
                    setCustomTotalEdited(false);
                    setTotalAmount(String(Math.round(calculatedPreview * 100) / 100));
                  }}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 700, padding: 0 }}
                >
                  Reset to {quantity} × {sellingPrice}
                </button>
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Buyer Name / Trader (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Ramesh Cotton Traders, APMC Mandi"
              value={buyerName}
              onChange={e => setBuyerName(e.target.value)}
              className="input"
              style={{ height: 40 }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
              Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Payment received via UPI, grade A quality"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input"
              style={{ height: 40 }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.65rem', marginTop: '0.5rem' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="btn btn-secondary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary"
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', fontWeight: 800 }}
            >
              {saving ? 'Saving…' : isEditing ? 'Update Income' : 'Record Income'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ViewReceiptModal({ expense, onClose, onEdit }) {
  if (!expense) return null;

  let parsedRaw = expense.extracted_details;
  if (!parsedRaw && expense.raw_extracted_json) {
    try {
      parsedRaw = typeof expense.raw_extracted_json === 'string'
        ? JSON.parse(expense.raw_extracted_json)
        : expense.raw_extracted_json;
    } catch {
      parsedRaw = null;
    }
  }

  const items = parsedRaw?.items || [];
  const isAiScanned = expense.receipt_source === 'AI_SCAN' || expense.receipt_source === 'SCANNED';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
    }}>
      <div style={{
        maxWidth: 720, width: '100%', background: 'var(--surface)',
        borderRadius: 'var(--radius-xl)', overflow: 'hidden',
        boxShadow: 'var(--shadow-xl)', maxHeight: '92vh', display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)',
          background: 'var(--surface)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 34, height: 34, borderRadius: 8,
              background: 'rgba(34, 197, 94, 0.12)', color: 'var(--primary)'
            }}>
              <Receipt size={18} />
            </span>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {expense.bill_number ? `Bill #${expense.bill_number}` : 'Receipt & Expense Details'}
              </h3>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {expense.date} • {expense.category}
              </span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '1.25rem 1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          {/* Top Amount Banner */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem',
            padding: '1rem 1.25rem', borderRadius: 'var(--radius-lg)',
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%)',
            border: '1px solid rgba(34, 197, 94, 0.25)'
          }}>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.04em' }}>
                Total Amount
              </span>
              <div style={{ fontSize: '1.75rem', fontWeight: 900, color: 'var(--primary)', lineHeight: 1.1 }}>
                {formatRs(expense.amount)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              <span style={{
                padding: '0.3rem 0.65rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 800,
                background: isAiScanned ? 'rgba(34, 197, 94, 0.15)' : 'var(--surface-secondary)',
                color: isAiScanned ? 'var(--primary)' : 'var(--text-secondary)',
                border: isAiScanned ? '1px solid rgba(34, 197, 94, 0.3)' : '1px solid var(--border)'
              }}>
                {isAiScanned ? '✨ AI Scanned' : '📝 Manual'}
              </span>
              <span style={{
                padding: '0.3rem 0.65rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                background: 'var(--surface-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)'
              }}>
                {expense.category}
              </span>
              {expense.crop && (
                <span style={{
                  padding: '0.3rem 0.65rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                  background: 'var(--surface-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border)'
                }}>
                  🌱 {expense.crop}
                </span>
              )}
            </div>
          </div>

          {/* Grid: Image & Vendor Metadata */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: expense.receipt_url ? 'repeat(auto-fit, minmax(260px, 1fr))' : '1fr',
            gap: '1rem'
          }}>
            {/* Receipt Image */}
            {expense.receipt_url && (
              <div style={{
                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                overflow: 'hidden', background: '#0f172a', display: 'flex', flexDirection: 'column'
              }}>
                <div style={{ maxHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '0.5rem' }}>
                  <img
                    src={expense.receipt_url}
                    alt="Receipt"
                    style={{ maxWidth: '100%', maxHeight: 260, objectFit: 'contain', borderRadius: 6 }}
                  />
                </div>
                <div style={{ padding: '0.5rem 0.75rem', background: 'var(--surface-secondary)', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Attached Receipt</span>
                  <a
                    href={expense.receipt_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}
                  >
                    <ExternalLink size={12} /> Open Full View
                  </a>
                </div>
              </div>
            )}

            {/* Vendor & Bill Details */}
            <div style={{
              background: 'var(--surface-secondary)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.65rem'
            }}>
              <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Vendor & Transaction Info
              </h4>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.8rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Vendor / Shop</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{expense.vendor_name || 'Not recorded'}</strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Bill / Invoice #</span>
                  <strong style={{ color: 'var(--text-primary)' }}>{expense.bill_number || 'N/A'}</strong>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Phone</span>
                  <span style={{ color: 'var(--text-primary)' }}>{expense.vendor_phone || 'N/A'}</span>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Payment Method</span>
                  <span style={{ color: 'var(--text-primary)' }}>{expense.payment_method || 'Cash'}</span>
                </div>

                {expense.vendor_address && (
                  <div style={{ gridColumn: 'span 2' }}>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Vendor Address</span>
                    <span style={{ color: 'var(--text-primary)' }}>{expense.vendor_address}</span>
                  </div>
                )}

                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Tax / GST</span>
                  <span style={{ color: 'var(--text-primary)' }}>{expense.tax ? formatRs(expense.tax) : '₹0'}</span>
                </div>

                <div>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Discount</span>
                  <span style={{ color: 'var(--text-primary)' }}>{expense.discount ? formatRs(expense.discount) : '₹0'}</span>
                </div>

                {expense.field_name && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Field / Plot</span>
                    <span style={{ color: 'var(--text-primary)' }}>{expense.field_name}</span>
                  </div>
                )}

                {expense.scanned_at && (
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Scanned At</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>{expense.scanned_at.split('T')[0]}</span>
                  </div>
                )}
              </div>

              {expense.description && (
                <div style={{ marginTop: '0.25rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', display: 'block' }}>Notes</span>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{expense.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Itemized Table if available */}
          {items && items.length > 0 && (
            <div style={{
              background: 'var(--surface)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)', overflow: 'hidden'
            }}>
              <div style={{ padding: '0.65rem 0.9rem', background: 'var(--surface-secondary)', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  📋 Extracted Line Items ({items.length})
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-secondary)', textAlign: 'left' }}>
                      <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Item</th>
                      <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Qty</th>
                      <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: 'var(--text-secondary)' }}>Unit Price</th>
                      <th style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600, color: 'var(--text-primary)' }}>{it.name}</td>
                        <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-secondary)' }}>{it.quantity} {it.unit}</td>
                        <td style={{ padding: '0.5rem 0.75rem', color: 'var(--text-secondary)' }}>{it.unit_price ? `₹${it.unit_price}` : '—'}</td>
                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'right' }}>₹{it.total_price || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '0.85rem 1.5rem', borderTop: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--surface)'
        }}>
          <button
            onClick={() => onEdit(expense)}
            className="btn btn-secondary"
            style={{ fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Edit2 size={14} /> Edit Expense Record
          </button>
          <button
            onClick={onClose}
            className="btn btn-primary"
            style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
