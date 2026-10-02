import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  Image as ImageIcon,
  Upload,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  X,
  RefreshCw,
  Eye,
  FileText,
  Plus,
  Trash2,
  DollarSign,
  Calendar,
  Store,
  Tag,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Info
} from 'lucide-react';
import { scanBillImage, createExpense } from '../services/apiService';

const STANDARD_EXPENSE_CATEGORIES = [
  'Fertilizer',
  'Seeds',
  'Pesticides',
  'Equipment / Machinery',
  'Fuel / Diesel',
  'Irrigation',
  'Labour / Wages',
  'Maintenance & Repairs',
  'Tractor Service',
  'Other'
];

const PAYMENT_METHODS = [
  'Cash',
  'UPI / PhonePe / GPay',
  'Bank Transfer / NEFT',
  'Cheque',
  'Debit / Credit Card',
  'Credit (Udhaar)',
  'Other'
];

export default function ScanBillModal({
  cropOptions = [],
  fieldOptions = [],
  onClose,
  onSaved,
  onSwitchToManual
}) {
  // Stages: 'SELECT' | 'PREVIEW' | 'SCANNING' | 'REVIEW' | 'UNREADABLE'
  const [stage, setStage] = useState('SELECT');
  const [selectedFile, setSelectedFile] = useState(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [showOriginalImage, setShowOriginalImage] = useState(false);

  // Scanning progress state
  const [scanStepIndex, setScanStepIndex] = useState(0);

  // Scan API result state
  const [extractedData, setExtractedData] = useState(null);
  const [receiptPath, setReceiptPath] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [totalsVerification, setTotalsVerification] = useState(null);
  const [duplicateCheck, setDuplicateCheck] = useState(null);
  const [confidenceIndicators, setConfidenceIndicators] = useState({});

  // Editable form fields
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState('Fertilizer');
  const [amount, setAmount] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [crop, setCrop] = useState('');
  const [fieldName, setFieldName] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [description, setDescription] = useState('');
  const [tax, setTax] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [items, setItems] = useState([]);
  const [showItemizedDetails, setShowItemizedDetails] = useState(false);

  // Status & error handling
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  // Stepped scanning message animation
  const scanningSteps = [
    { title: '📄 Reading your bill...', subtitle: 'Analyzing image clarity and orientation' },
    { title: '🔍 Extracting bill details...', subtitle: 'Detecting vendor, line items, taxes & grand total' },
    { title: '✓ Information extracted', subtitle: 'Verifying mathematical totals and duplicate checks' }
  ];

  useEffect(() => {
    let interval;
    if (stage === 'SCANNING') {
      setScanStepIndex(0);
      interval = setInterval(() => {
        setScanStepIndex((prev) => (prev < scanningSteps.length - 1 ? prev + 1 : prev));
      }, 1400);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [stage]);

  // Clean up object URLs
  useEffect(() => {
    return () => {
      if (imagePreviewUrl && imagePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const handleFileSelection = (e) => {
    setErrorMsg(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/bmp'];
    if (file.type && !validTypes.includes(file.type.toLowerCase())) {
      setErrorMsg('Please upload a valid bill image (JPG, JPEG, PNG, or WebP).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg('Image size exceeds 10MB limit. Please take a lighter photo.');
      return;
    }

    setSelectedFile(file);
    const previewUrl = URL.createObjectURL(file);
    setImagePreviewUrl(previewUrl);
    setStage('PREVIEW');
  };

  const handleStartScan = async () => {
    if (!selectedFile) {
      setErrorMsg('Please choose or capture a bill photo first.');
      return;
    }

    setErrorMsg(null);
    setStage('SCANNING');

    try {
      const res = await scanBillImage(selectedFile);

      if (!res.success || !res.extracted_data) {
        throw new Error(res.error || 'Farmer AI could not read this bill clearly.');
      }

      const ext = res.extracted_data;
      setExtractedData(ext);
      setReceiptPath(res.receipt_path || '');
      setReceiptUrl(res.receipt_url || imagePreviewUrl);
      setTotalsVerification(res.totals_verification || null);
      setDuplicateCheck(res.duplicate_check || null);
      setConfidenceIndicators(res.confidence_indicators || {});

      // Pre-fill editable state from AI extraction (with strictly no invented values)
      if (ext.bill_date) setDate(ext.bill_date);
      if (ext.category) setCategory(ext.category);
      if (ext.grand_total !== null && ext.grand_total !== undefined) {
        setAmount(String(ext.grand_total));
      } else if (ext.subtotal !== null && ext.subtotal !== undefined) {
        setAmount(String(ext.subtotal));
      } else {
        setAmount('');
      }

      setVendorName(ext.vendor_name || '');
      setVendorPhone(ext.vendor_phone || '');
      setVendorAddress(ext.vendor_address || '');
      setBillNumber(ext.bill_number || '');
      setPaymentMethod(ext.payment_method || 'Cash');
      setTax(ext.tax !== null && ext.tax !== undefined ? String(ext.tax) : '0');
      setDiscount(ext.discount !== null && ext.discount !== undefined ? String(ext.discount) : '0');

      if (Array.isArray(ext.items) && ext.items.length > 0) {
        setItems(ext.items.map((it, idx) => ({
          id: idx + 1,
          name: it.name || '',
          quantity: it.quantity !== null && it.quantity !== undefined ? it.quantity : '',
          unit: it.unit || '',
          unit_price: it.unit_price !== null && it.unit_price !== undefined ? it.unit_price : '',
          total: it.total !== null && it.total !== undefined ? it.total : ''
        })));
        setShowItemizedDetails(true);
      } else {
        setItems([]);
      }

      // Default description
      if (ext.suggested_description) {
        setDescription(ext.suggested_description);
      } else if (ext.vendor_name) {
        setDescription(`${ext.category || 'Farming items'} purchased from ${ext.vendor_name}`);
      } else {
        setDescription(`${ext.category || 'Farm expense'} purchase`);
      }

      // Default crop if available in options
      if (cropOptions.length > 0 && !crop) {
        setCrop(cropOptions[0]);
      }
      if (fieldOptions.length > 0 && !fieldName) {
        setFieldName(fieldOptions[0]);
      }

      setStage('REVIEW');
    } catch (err) {
      console.error('Bill Scan Error:', err);
      setErrorMsg(err.message || 'Farmer AI could not read this bill clearly. Please take a clearer photo.');
      setStage('UNREADABLE');
    }
  };

  const handleAddItemRow = () => {
    setItems((prev) => [
      ...prev,
      { id: Date.now(), name: '', quantity: 1, unit: 'bags', unit_price: '', total: '' }
    ]);
  };

  const handleUpdateItemRow = (id, field, val) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id === id) {
          const updated = { ...it, [field]: val };
          // Auto calculate total if qty and price present
          if (field === 'quantity' || field === 'unit_price') {
            const q = parseFloat(field === 'quantity' ? val : it.quantity);
            const p = parseFloat(field === 'unit_price' ? val : it.unit_price);
            if (!isNaN(q) && !isNaN(p)) {
              updated.total = (q * p).toFixed(2);
            }
          }
          return updated;
        }
        return it;
      })
    );
  };

  const handleRemoveItemRow = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const handleSaveConfirmedExpense = async () => {
    setErrorMsg(null);

    if (!date) {
      setErrorMsg('Please specify the expense date.');
      return;
    }
    if (!category) {
      setErrorMsg('Please select an expense category.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount < 0) {
      setErrorMsg('Please enter a valid positive expense amount.');
      return;
    }

    const numTax = parseFloat(tax) || 0.0;
    const numDiscount = parseFloat(discount) || 0.0;

    const rawPayload = {
      vendor_name: vendorName || null,
      vendor_phone: vendorPhone || null,
      vendor_address: vendorAddress || null,
      bill_number: billNumber || null,
      bill_date: date,
      category,
      crop: crop || null,
      field_name: fieldName || null,
      grand_total: numAmount,
      tax: numTax,
      discount: numDiscount,
      payment_method: paymentMethod || null,
      items: items.map((it) => ({
        name: it.name,
        quantity: parseFloat(it.quantity) || null,
        unit: it.unit || null,
        unit_price: parseFloat(it.unit_price) || null,
        total: parseFloat(it.total) || null
      })),
      notes: description || null
    };

    setSaving(true);
    try {
      const expenseData = {
        date,
        category,
        amount: numAmount,
        crop: crop.trim(),
        field_name: fieldName.trim(),
        description: description.trim(),
        receipt_path: receiptPath || null,
        bill_number: billNumber.trim() || null,
        vendor_name: vendorName.trim() || null,
        vendor_phone: vendorPhone.trim() || null,
        vendor_address: vendorAddress.trim() || null,
        receipt_source: 'SCANNED_RECEIPT',
        raw_extracted_json: rawPayload,
        tax: numTax,
        discount: numDiscount,
        payment_method: paymentMethod || null
      };

      await createExpense(expenseData);
      onSaved({
        type: 'success',
        text: `Scanned expense of ₹${numAmount.toLocaleString('en-IN')} from ${vendorName || category} saved to Farm Diary!`
      });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to save scanned expense. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const formatConfidence = (level) => {
    if (!level || level === 'none') {
      return (
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
          Not detected
        </span>
      );
    }
    if (level === 'high') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', color: '#16a34a', fontWeight: 800 }}>
          <CheckCircle2 size={13} /> Verified
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.72rem', color: '#d97706', fontWeight: 800 }}>
        <Info size={13} /> Please check
      </span>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0.75rem',
        animation: 'fadeIn 200ms ease'
      }}
    >
      <div
        style={{
          maxWidth: stage === 'REVIEW' ? 640 : 520,
          width: '100%',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          boxShadow: 'var(--shadow-lg)',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          border: '1px solid var(--border)',
          transition: 'all 240ms ease'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '1rem 1.4rem',
            borderBottom: '1px solid var(--border)',
            background: 'var(--surface-secondary)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'rgba(34, 197, 94, 0.15)',
                color: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Camera size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                {stage === 'REVIEW' ? 'Review Scanned Bill' : 'Scan Farming Bill'}
              </h3>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                {stage === 'REVIEW'
                  ? 'Verify extracted details before saving to expenses'
                  : 'Automatic AI bill reading for fertilizer, seeds & machinery'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: 4
            }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body content */}
        <div style={{ padding: '1.25rem 1.4rem', overflowY: 'auto', flex: 1 }}>
          {errorMsg && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.65rem',
                padding: '0.75rem 1rem',
                borderRadius: 10,
                background: 'var(--danger-bg)',
                color: 'var(--danger)',
                border: '1px solid rgba(220,38,38,0.3)',
                fontSize: '0.825rem',
                fontWeight: 600,
                marginBottom: '1rem'
              }}
            >
              <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
              <span style={{ flex: 1 }}>{errorMsg}</span>
            </div>
          )}

          {/* Hidden File Inputs for Camera & Gallery */}
          <input
            type="file"
            ref={cameraInputRef}
            accept="image/jpeg,image/png,image/webp,image/jpg"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleFileSelection}
          />
          <input
            type="file"
            ref={galleryInputRef}
            accept="image/jpeg,image/png,image/webp,image/jpg"
            style={{ display: 'none' }}
            onChange={handleFileSelection}
          />

          {/* STAGE 1: SELECT / CAPTURE IMAGE */}
          {stage === 'SELECT' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', textAlign: 'center', padding: '0.5rem 0' }}>
              <div
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '2rem 1.5rem',
                  background: 'var(--surface-secondary)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.75rem'
                }}
              >
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: '50%',
                    background: 'rgba(34, 197, 94, 0.12)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 4
                  }}
                >
                  <FileText size={30} />
                </div>
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  Take a photo of your bill
                </h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.45 }}>
                  Take a clear photo of the complete bill so Farmer AI can read the details.
                </p>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                    gap: '0.75rem',
                    width: '100%',
                    marginTop: '0.75rem'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="btn btn-primary"
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-lg)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      fontWeight: 800,
                      fontSize: '0.9rem',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                    id="btn-bill-take-photo"
                  >
                    <Camera size={18} />
                    Take Photo
                  </button>

                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    style={{
                      padding: '0.85rem 1rem',
                      borderRadius: 'var(--radius-lg)',
                      border: '1px solid var(--border)',
                      background: 'var(--surface)',
                      color: 'var(--text-primary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '0.5rem',
                      fontWeight: 700,
                      fontSize: '0.9rem',
                      cursor: 'pointer',
                      boxShadow: 'var(--shadow-sm)'
                    }}
                    id="btn-bill-choose-gallery"
                  >
                    <ImageIcon size={18} style={{ color: 'var(--primary)' }} />
                    Choose from Gallery
                  </button>
                </div>

                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Supported formats: <strong>JPG, JPEG, PNG, WebP</strong> (Max 10MB)
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  borderRadius: 10,
                  background: 'var(--surface-secondary)',
                  border: '1px solid var(--border)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <Sparkles size={16} style={{ color: 'var(--primary)' }} />
                  <span>Prefer entering expense without scanning?</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onSwitchToManual) onSwitchToManual();
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--primary)',
                    fontWeight: 800,
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  + Enter Manually
                </button>
              </div>
            </div>
          )}

          {/* STAGE 2: PREVIEW IMAGE BEFORE SCAN */}
          {stage === 'PREVIEW' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxHeight: 340,
                  borderRadius: 'var(--radius-xl)',
                  overflow: 'hidden',
                  background: '#000',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '1px solid var(--border)'
                }}
              >
                {imagePreviewUrl && (
                  <img
                    src={imagePreviewUrl}
                    alt="Bill Preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: 340,
                      objectFit: 'contain'
                    }}
                  />
                )}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 10,
                    left: 10,
                    right: 10,
                    padding: '0.4rem 0.75rem',
                    borderRadius: 8,
                    background: 'rgba(0,0,0,0.65)',
                    backdropFilter: 'blur(4px)',
                    color: '#FFF',
                    fontSize: '0.75rem',
                    textAlign: 'center'
                  }}
                >
                  Check that the bill number, vendor name, and grand total are clearly visible.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={handleStartScan}
                  className="btn btn-primary"
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    fontWeight: 800,
                    fontSize: '0.95rem'
                  }}
                  id="btn-confirm-scan-bill"
                >
                  <Sparkles size={18} />
                  Scan Bill
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setImagePreviewUrl(null);
                    setStage('SELECT');
                  }}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-lg)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    fontWeight: 700,
                    fontSize: '0.9rem'
                  }}
                >
                  <RefreshCw size={16} />
                  Retake Photo
                </button>
              </div>
            </div>
          )}

          {/* STAGE 3: SCANNING IN PROGRESS */}
          {stage === 'SCANNING' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2.5rem 1rem',
                textAlign: 'center',
                gap: '1.25rem'
              }}
            >
              <div style={{ position: 'relative', width: 70, height: 70 }}>
                <div
                  style={{
                    width: 70,
                    height: 70,
                    borderRadius: '50%',
                    border: '4px solid var(--border)',
                    borderTopColor: 'var(--primary)',
                    animation: 'spin 1s linear infinite'
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--primary)'
                  }}
                >
                  <Sparkles size={24} />
                </div>
              </div>

              <div>
                <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  {scanningSteps[scanStepIndex].title}
                </h4>
                <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                  {scanningSteps[scanStepIndex].subtitle}
                </p>
              </div>

              <div
                style={{
                  width: '100%',
                  maxWidth: 320,
                  height: 6,
                  borderRadius: 6,
                  background: 'var(--surface-secondary)',
                  overflow: 'hidden'
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${((scanStepIndex + 1) / scanningSteps.length) * 100}%`,
                    background: 'var(--primary)',
                    borderRadius: 6,
                    transition: 'width 600ms ease'
                  }}
                />
              </div>

              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
                Securing data strictly on the server…
              </p>
            </div>
          )}

          {/* STAGE 4: REVIEW & EDIT EXTRACTED BILL */}
          {stage === 'REVIEW' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Top AI Verification Summary */}
              <div
                style={{
                  padding: '0.9rem 1.1rem',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--surface-secondary)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.65rem'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                    <ShieldCheck size={17} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontSize: '0.825rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                      Detected Bill Information
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowOriginalImage(!showOriginalImage)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--primary)',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <Eye size={13} />
                    {showOriginalImage ? 'Hide Original Bill' : 'View Original Bill'}
                  </button>
                </div>

                {/* Scanned preview image accordion */}
                {showOriginalImage && receiptUrl && (
                  <div
                    style={{
                      borderRadius: 10,
                      overflow: 'hidden',
                      background: '#000',
                      maxHeight: 220,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid var(--border)',
                      marginTop: 4
                    }}
                  >
                    <img
                      src={receiptUrl}
                      alt="Scanned Bill Receipt"
                      style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'contain' }}
                    />
                  </div>
                )}

                {/* Quick Confidence Grid */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                    gap: '0.5rem',
                    fontSize: '0.78rem',
                    background: 'var(--surface)',
                    padding: '0.65rem 0.75rem',
                    borderRadius: 8,
                    border: '1px solid var(--border)'
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Vendor: </span>
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {vendorName || 'Not detected'} {formatConfidence(confidenceIndicators.vendor_name)}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Bill Date: </span>
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                      {date || 'Not detected'} {formatConfidence(confidenceIndicators.bill_date)}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Category: </span>
                    <div style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                      {category} {formatConfidence(confidenceIndicators.category)}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>Total Amount: </span>
                    <div style={{ fontWeight: 900, color: 'var(--danger)', fontSize: '0.9rem' }}>
                      ₹{amount ? Number(amount).toLocaleString('en-IN') : '0'} {formatConfidence(confidenceIndicators.grand_total)}
                    </div>
                  </div>
                </div>

                {/* Verification Notice */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <AlertTriangle size={14} style={{ color: '#d97706', flexShrink: 0 }} />
                  <span>Please verify the detected information before saving.</span>
                </div>
              </div>

              {/* Mathematical Discrepancy Warning */}
              {totalsVerification && !totalsVerification.matches && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem',
                    padding: '0.75rem 1rem',
                    borderRadius: 10,
                    background: 'rgba(217, 119, 6, 0.12)',
                    color: '#b45309',
                    border: '1px solid rgba(217, 119, 6, 0.3)',
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }}
                >
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontWeight: 800 }}>⚠️ {totalsVerification.warning}</div>
                    {totalsVerification.details?.slice(0, 2).map((det, idx) => (
                      <div key={idx} style={{ fontSize: '0.72rem', marginTop: 2 }}>• {det}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* Duplicate Detection Warning */}
              {duplicateCheck && duplicateCheck.is_duplicate && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.65rem',
                    padding: '0.75rem 1rem',
                    borderRadius: 10,
                    background: 'rgba(239, 68, 68, 0.1)',
                    color: 'var(--danger)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    fontSize: '0.825rem'
                  }}
                >
                  <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <strong style={{ display: 'block', marginBottom: 2 }}>Possible Duplicate Expense Found</strong>
                    <div style={{ fontSize: '0.75rem' }}>{duplicateCheck.message}</div>
                  </div>
                </div>
              )}

              {/* Editable Fields Form */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Total Amount (₹) *
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
                        onChange={(e) => setAmount(e.target.value)}
                        className="input"
                        style={{ height: 42, paddingLeft: '1.8rem', fontWeight: 900, fontSize: '1.15rem', color: 'var(--text-primary)' }}
                        id="input-scanned-amount"
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Bill Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="input"
                      style={{ height: 42 }}
                      id="input-scanned-date"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Expense Category *
                    </label>
                    <select
                      required
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="input"
                      style={{ height: 40 }}
                      id="select-scanned-category"
                    >
                      {STANDARD_EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Bill / Invoice Number
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. INV-1025"
                      value={billNumber}
                      onChange={(e) => setBillNumber(e.target.value)}
                      className="input"
                      style={{ height: 40 }}
                      id="input-scanned-billno"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Shop / Vendor Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. ABC Fertilizers"
                      value={vendorName}
                      onChange={(e) => setVendorName(e.target.value)}
                      className="input"
                      style={{ height: 40 }}
                      id="input-scanned-vendor"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Payment Method
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="input"
                      style={{ height: 40 }}
                    >
                      {PAYMENT_METHODS.map((pm) => (
                        <option key={pm} value={pm}>
                          {pm}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Farmer Crop and Field Selection (From existing farmer data) */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Associated Crop
                    </label>
                    <input
                      list="crop-options-scanned"
                      type="text"
                      placeholder="e.g. Cotton, Paddy"
                      value={crop}
                      onChange={(e) => setCrop(e.target.value)}
                      className="input"
                      style={{ height: 40 }}
                    />
                    <datalist id="crop-options-scanned">
                      {cropOptions.map((c) => (
                        <option key={c} value={c} />
                      ))}
                    </datalist>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                      Field / Plot
                    </label>
                    <input
                      list="field-options-scanned"
                      type="text"
                      placeholder="e.g. Main Field, North Acre"
                      value={fieldName}
                      onChange={(e) => setFieldName(e.target.value)}
                      className="input"
                      style={{ height: 40 }}
                    />
                    <datalist id="field-options-scanned">
                      {fieldOptions.map((f) => (
                        <option key={f} value={f} />
                      ))}
                    </datalist>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 4 }}>
                    Expense Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fertilizer purchased from ABC Fertilizers"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="input"
                    style={{ height: 40 }}
                  />
                </div>

                {/* Itemized breakdown toggle */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowItemizedDetails(!showItemizedDetails)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      fontWeight: 700
                    }}
                  >
                    <span>
                      Itemized Bill Breakdown ({items.length} item{items.length === 1 ? '' : 's'})
                    </span>
                    {showItemizedDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {showItemizedDetails && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {items.map((it) => (
                        <div
                          key={it.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                            gap: '0.4rem',
                            alignItems: 'center',
                            background: 'var(--surface-secondary)',
                            padding: '0.5rem 0.65rem',
                            borderRadius: 8,
                            border: '1px solid var(--border)'
                          }}
                        >
                          <input
                            type="text"
                            placeholder="Item name (e.g. Urea)"
                            value={it.name}
                            onChange={(e) => handleUpdateItemRow(it.id, 'name', e.target.value)}
                            className="input"
                            style={{ height: 34, fontSize: '0.78rem' }}
                          />
                          <input
                            type="number"
                            placeholder="Qty"
                            value={it.quantity}
                            onChange={(e) => handleUpdateItemRow(it.id, 'quantity', e.target.value)}
                            className="input"
                            style={{ height: 34, fontSize: '0.78rem' }}
                          />
                          <input
                            type="number"
                            placeholder="Rate (₹)"
                            value={it.unit_price}
                            onChange={(e) => handleUpdateItemRow(it.id, 'unit_price', e.target.value)}
                            className="input"
                            style={{ height: 34, fontSize: '0.78rem' }}
                          />
                          <input
                            type="number"
                            placeholder="Total (₹)"
                            value={it.total}
                            onChange={(e) => handleUpdateItemRow(it.id, 'total', e.target.value)}
                            className="input"
                            style={{ height: 34, fontSize: '0.78rem', fontWeight: 700 }}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveItemRow(it.id)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--danger)',
                              cursor: 'pointer',
                              padding: 4
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                        <button
                          type="button"
                          onClick={handleAddItemRow}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          <Plus size={14} /> Add Item Row
                        </button>

                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.78rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>
                            Tax/GST: <strong style={{ color: 'var(--text-primary)' }}>₹{tax}</strong>
                          </span>
                          <span style={{ color: 'var(--text-muted)' }}>
                            Discount: <strong style={{ color: 'var(--text-primary)' }}>₹{discount}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* STAGE 5: UNREADABLE BILL FALLBACK */}
          {stage === 'UNREADABLE' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '2rem 1rem',
                textAlign: 'center',
                gap: '1rem'
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--danger-bg)',
                  color: 'var(--danger)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <AlertCircle size={28} />
              </div>
              <div>
                <h4 style={{ margin: '0 0 0.35rem 0', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                  We couldn't read this bill clearly
                </h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary)', maxWidth: 360, lineHeight: 1.45 }}>
                  The photo might be blurry, too dark, or partially cut off. Please take a clearer photo with all corners visible.
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', width: '100%', maxWidth: 360, marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFile(null);
                    setImagePreviewUrl(null);
                    setStage('SELECT');
                  }}
                  className="btn btn-primary"
                  style={{
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    fontWeight: 800,
                    fontSize: '0.9rem'
                  }}
                >
                  <RefreshCw size={16} /> Try Again
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onSwitchToManual) onSwitchToManual();
                  }}
                  className="btn btn-secondary"
                  style={{
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    fontWeight: 700,
                    fontSize: '0.9rem'
                  }}
                >
                  + Enter Manually
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        {stage === 'REVIEW' && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.9rem 1.4rem',
              borderTop: '1px solid var(--border)',
              background: 'var(--surface-secondary)'
            }}
          >
            <button
              type="button"
              onClick={() => {
                setSelectedFile(null);
                setImagePreviewUrl(null);
                setStage('SELECT');
              }}
              disabled={saving}
              className="btn btn-secondary"
              style={{ padding: '0.55rem 0.95rem', fontSize: '0.85rem' }}
            >
              <RefreshCw size={14} style={{ marginRight: 4 }} />
              Scan Again
            </button>

            <div style={{ display: 'flex', gap: '0.65rem' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={saving}
                className="btn btn-secondary"
                style={{ padding: '0.55rem 0.95rem', fontSize: '0.85rem' }}
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSaveConfirmedExpense}
                disabled={saving}
                className="btn btn-primary"
                style={{
                  padding: '0.55rem 1.35rem',
                  fontSize: '0.875rem',
                  fontWeight: 800,
                  background: duplicateCheck?.is_duplicate ? '#d97706' : 'var(--primary)'
                }}
                id="btn-save-scanned-expense"
              >
                {saving ? 'Saving Expense…' : duplicateCheck?.is_duplicate ? 'Save Anyway' : 'Save Expense'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
