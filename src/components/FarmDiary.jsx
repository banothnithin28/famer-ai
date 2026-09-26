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
  getPlants
} from '../services/apiService';

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

  const [diaryModalOpen, setDiaryModalOpen] = useState(false);
  const [editingDiary, setEditingDiary] = useState(null);

  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);

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
      const matchSearch = !searchQuery.trim() || [
        exp.category,
        exp.crop,
        exp.field_name,
        exp.description
      ].some(val => (val || '').toLowerCase().includes(searchQuery.toLowerCase()));
      return matchCategory && matchCrop && matchMonth && matchSearch;
    });
  }, [expenses, filterCategory, filterCrop, filterMonth, searchQuery]);

  const filteredExpensesTotal = useMemo(() => {
    return filteredExpenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  }, [filteredExpenses]);

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
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '0.75rem',
          marginTop: '1rem'
        }}>
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

              <button
                onClick={() => { setEditingExpense(null); setExpenseModalOpen(true); }}
                className="btn btn-primary btn-sm"
              >
                <Plus size={15} /> Add New Expense
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
              <div style={{ position: 'relative' }}>
                <Search size={15} style={{ position: 'absolute', left: 10, top: 11, color: 'var(--text-muted)' }} />
                <input
                  type="text"
                  placeholder="Search expenses…"
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

              {(searchQuery || filterCategory || filterCrop || filterMonth) && (
                <button
                  onClick={() => { setSearchQuery(''); setFilterCategory(''); setFilterCrop(''); setFilterMonth(''); }}
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
                No expenses recorded
              </h3>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Keep track of seeds, fertilizers, tractor rental, and labour charges.
              </p>
              <button
                onClick={() => { setEditingExpense(null); setExpenseModalOpen(true); }}
                className="btn btn-primary btn-sm"
              >
                <Plus size={15} /> Add First Expense
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1rem' }}>
              {filteredExpenses.map(exp => (
                <div
                  key={exp.id}
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
                        {exp.date}
                      </span>
                      <span style={{
                        fontSize: '0.72rem', fontWeight: 800, padding: '0.2rem 0.55rem', borderRadius: 'var(--radius-full)',
                        background: 'var(--danger-bg)', color: 'var(--danger)'
                      }}>
                        {exp.category}
                      </span>
                    </div>

                    <div style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--text-primary)', marginBottom: '0.4rem', lineHeight: 1.1 }}>
                      {formatRs(exp.amount)}
                    </div>

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

                    {exp.receipt_url && (
                      <div style={{ marginBottom: '0.65rem' }}>
                        <button
                          onClick={() => setMediaPreview({ url: exp.receipt_url, title: `${exp.category} Receipt`, type: 'Receipt Bill' })}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.35rem 0.65rem', borderRadius: 8,
                            border: '1px solid var(--border)', background: 'var(--surface-secondary)',
                            fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', cursor: 'pointer'
                          }}
                        >
                          <Receipt size={13} />
                          <span>View Bill / Receipt</span>
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
              ))}
            </div>
          )}
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
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(expense?.receipt_url || null);
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
        maxWidth: 520, width: '100%', background: 'var(--surface)',
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
