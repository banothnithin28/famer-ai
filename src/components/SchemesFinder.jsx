import React, { useState } from 'react';
import { 
  FileText, 
  Search, 
  CheckCircle2, 
  ExternalLink, 
  ShieldCheck, 
  Award, 
  ChevronRight, 
  HelpCircle,
  Sparkles,
  Info
} from 'lucide-react';

export default function SchemesFinder() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [activeSchemeDetail, setActiveSchemeDetail] = useState(null);

  const schemes = [
    {
      id: 1,
      name: 'PM-KISAN Samman Nidhi',
      category: 'Direct Income',
      benefit: '₹6,000 / year in 3 equal installments directly to bank account',
      target: 'Small & Marginal Farmers with cultivable land',
      subsidy: '100% Direct Cash Transfer',
      documents: ['Land Records (Khasra/Khatauni)', 'Aadhaar Card', 'Active Bank Account', 'Mobile Number'],
      officialUrl: 'https://pmkisan.gov.in',
      desc: 'Provides financial support to all landholding farmer families across the country to enable them to take care of expenses related to agriculture and domestic needs.'
    },
    {
      id: 2,
      name: 'Pradhan Mantri Fasal Bima Yojana (PMFBY)',
      category: 'Crop Insurance',
      benefit: 'Comprehensive crop loss cover against natural calamities, pests & diseases',
      target: 'All farmers growing notified crops in notified areas',
      subsidy: 'Premium capped at 1.5% for Rabi, 2% for Kharif crops',
      documents: ['Land Possession Certificate', 'Sowing Certificate', 'Aadhaar Card', 'Bank Passbook'],
      officialUrl: 'https://pmfby.gov.in',
      desc: 'Formulated to reduce financial distress caused by unexpected yield loss arising from severe drought, flood, inundation, or pest outbreaks.'
    },
    {
      id: 3,
      name: 'PM-KUSUM Solar Pump Scheme',
      category: 'Solar Equipment',
      benefit: 'Up to 60% subsidy for installing standalone off-grid solar agriculture pumps',
      target: 'Individual farmers, FPOs, water user associations',
      subsidy: '60% Govt Subsidy + 30% Bank Loan (Farmer pays only 10%)',
      documents: ['Land Ownership Documents', 'Aadhaar Card', 'Bank Account', 'Electricity Connection Status'],
      officialUrl: 'https://pmkusum.mnre.gov.in',
      desc: 'Provides energy security to farmers by replacing diesel agriculture pumps with clean solar energy pumps and allowing surplus power sale.'
    },
    {
      id: 4,
      name: 'Soil Health Card Scheme',
      category: 'Soil & Seeds',
      benefit: 'Free soil testing report with customized fertilizer & manure advice for 12 parameters',
      target: 'All farmers across all states',
      subsidy: '100% Free Testing by Govt Labs',
      documents: ['Farmer Aadhaar Card', 'GPS Field Location / Khatauni'],
      officialUrl: 'https://soilhealth.dac.gov.in',
      desc: 'Issues soil health cards to farmers every 2 years so that remedies can be taken to cure soil nutrient deficiencies.'
    },
    {
      id: 5,
      name: 'Sub-Mission on Agricultural Mechanization (SMAM)',
      category: 'Machinery',
      benefit: '40% to 80% subsidy on tractors, harvesters, rotavators & laser land levelers',
      target: 'Farmers, Custom Hiring Centers, FPOs',
      subsidy: '40% - 50% for individual farmers; 80% for Custom Hiring Centers',
      documents: ['Aadhaar Card', 'Land Record Proof', 'Caste Certificate (if applicable)', 'Bank Passbook'],
      officialUrl: 'https://agrimachinery.nic.in',
      desc: 'Promotes agricultural mechanization to small and marginal farmers to increase farm productivity and reduce labor costs.'
    }
  ];

  const categories = ['All', 'Direct Income', 'Crop Insurance', 'Solar Equipment', 'Soil & Seeds', 'Machinery'];

  const filteredSchemes = schemes.filter((s) => {
    const matchesCat = selectedCategory === 'All' || s.category === selectedCategory;
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          s.desc.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      
      {/* Title */}
      <div>
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-950/80 text-purple-800 dark:text-purple-300 text-xs font-bold border border-purple-200 dark:border-purple-800">
          <FileText className="w-4 h-4" /> Financial Support & Subsidies
        </div>
        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight mt-1">
          Government Agriculture Schemes Finder
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Discover central & state agricultural support schemes, check eligibility criteria, and review document checklists.
        </p>
      </div>

      {/* Search & Category Filter */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search scheme name or benefit..."
            className="w-full bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm focus:outline-none focus:border-purple-500"
          />
        </div>

        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto scrollbar-none">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                selectedCategory === cat
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Scheme Cards Grid */}
      <div className="space-y-4">
        {filteredSchemes.map((scheme) => (
          <div
            key={scheme.id}
            className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs hover:border-purple-400 transition-all space-y-4"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/60 px-2.5 py-0.5 rounded-md border border-purple-200 dark:border-purple-900">
                  {scheme.category}
                </span>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1.5">
                  {scheme.name}
                </h3>
              </div>

              <div className="text-right">
                <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/80 px-3 py-1.5 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  {scheme.subsidy}
                </span>
              </div>
            </div>

            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {scheme.desc}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/40 p-4 rounded-xl border border-slate-100 dark:border-slate-800 text-xs">
              <div>
                <span className="font-bold text-slate-500 block mb-1">Key Financial Benefit:</span>
                <span className="font-bold text-slate-900 dark:text-white">{scheme.benefit}</span>
              </div>
              <div>
                <span className="font-bold text-slate-500 block mb-1">Eligible Target Audience:</span>
                <span className="font-semibold text-slate-700 dark:text-slate-300">{scheme.target}</span>
              </div>
            </div>

            {/* Document Checklist */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Required Application Documents:
              </span>
              <div className="flex flex-wrap gap-2">
                {scheme.documents.map((doc, idx) => (
                  <span
                    key={idx}
                    className="text-xs font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700"
                  >
                    • {doc}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <a
                href={scheme.officialUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 hover:underline"
              >
                <span>Visit Official Portal</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
