// Farmer AI - Main JavaScript File

document.addEventListener('DOMContentLoaded', () => {
    initLanguageSelector();
    initImageUploadPreview();
});

// Language Switcher Logic
function initLanguageSelector() {
    const langSelect = document.getElementById('langSelect');
    if (!langSelect) return;

    // Load saved language or default to 'en'
    const currentLang = localStorage.getItem('farmer_lang') || 'en';
    langSelect.value = currentLang;
    applyLanguage(currentLang);

    langSelect.addEventListener('change', (e) => {
        const lang = e.target.value;
        localStorage.setItem('farmer_lang', lang);
        applyLanguage(lang);
    });
}

function applyLanguage(lang) {
    if (typeof TRANSLATIONS === 'undefined' || !TRANSLATIONS[lang]) return;
    const dict = TRANSLATIONS[lang];

    document.querySelectorAll('[data-i18n]').forEach(elem => {
        const key = elem.getAttribute('data-i18n');
        if (dict[key]) {
            if (elem.tagName === 'INPUT' && elem.getAttribute('placeholder')) {
                elem.placeholder = dict[key];
            } else {
                elem.innerHTML = dict[key];
            }
        }
    });
}

// Image Preview for Leaf Disease Detection
function initImageUploadPreview() {
    const dropzone = document.getElementById('leafDropzone');
    const fileInput = document.getElementById('leafInput');
    const preview = document.getElementById('image-preview');

    if (!dropzone || !fileInput) return;

    dropzone.addEventListener('click', () => fileInput.click());

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            showPreview(fileInput.files[0]);
        }
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
            showPreview(fileInput.files[0]);
        }
    });

    function showPreview(file) {
        if (file && preview) {
            const reader = new FileReader();
            reader.onload = (e) => {
                preview.src = e.target.result;
                preview.style.display = 'block';
            };
            reader.readAsDataURL(file);
        }
    }
}

// Global Toast / Notification helper
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position:fixed; bottom:20px; right:20px; z-index:9999; display:flex; flex-direction:column; gap:10px;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.cssText = `
        background: ${type === 'error' ? '#d32f2f' : type === 'success' ? '#2e7d32' : '#0288d1'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        font-weight: 600;
        animation: fadeIn 0.3s ease;
    `;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}
