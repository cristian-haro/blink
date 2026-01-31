// i18n.js - Internationalization utility
let currentLanguage = 'es';
let translations = {};

// Detect browser language
function detectLanguage() {
    const saved = localStorage.getItem('blink-language');
    if (saved) return saved;
    
    const browserLang = navigator.language || navigator.userLanguage;
    return browserLang.startsWith('es') ? 'es' : 'en';
}

// Load translation file
async function loadTranslations(lang) {
    try {
        const response = await fetch(`/i18n/${lang}.json`);
        translations = await response.json();
        currentLanguage = lang;
        localStorage.setItem('blink-language', lang);
        return translations;
    } catch (error) {
        console.error('Error loading translations:', error);
        // Fallback to Spanish if loading fails
        if (lang !== 'es') {
            return loadTranslations('es');
        }
    }
}

// Get translation by key path (e.g., "index.messageLabel")
function t(keyPath, replacements = {}) {
    const keys = keyPath.split('.');
    let value = translations;
    
    for (const key of keys) {
        if (value && typeof value === 'object') {
            value = value[key];
        } else {
            console.warn(`Translation key not found: ${keyPath}`);
            return keyPath;
        }
    }
    
    if (typeof value !== 'string') {
        console.warn(`Translation value is not a string: ${keyPath}`);
        return keyPath;
    }
    
    // Replace placeholders like {fileName}, {remaining}, etc.
    let result = value;
    for (const [key, val] of Object.entries(replacements)) {
        result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), val);
    }
    
    return result;
}

// Update all elements with data-i18n attributes
function updatePageLanguage() {
    // Update text content
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        const translation = t(key);
        
        // Check if element contains HTML (like <strong> tags)
        if (translation.includes('<')) {
            element.innerHTML = translation;
        } else {
            element.textContent = translation;
        }
    });
    
    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        element.placeholder = t(key);
    });
    
    // Update title
    const titleKey = document.documentElement.getAttribute('data-i18n-title');
    if (titleKey) {
        document.title = t(titleKey);
    }
    
    // Update html lang attribute
    document.documentElement.lang = currentLanguage;
    
    // Update language switcher button text
    const langBtn = document.getElementById('languageBtn');
    if (langBtn) {
        langBtn.textContent = t('language.switchTo');
    }
}

// Toggle language
function toggleLanguage() {
    const newLang = currentLanguage === 'es' ? 'en' : 'es';
    loadTranslations(newLang).then(() => {
        updatePageLanguage();
    });
}

// Initialize i18n on page load
async function initI18n() {
    const lang = detectLanguage();
    await loadTranslations(lang);
    updatePageLanguage();
    
    // Set up language switcher button if it exists
    const langBtn = document.getElementById('languageBtn');
    if (langBtn) {
        langBtn.addEventListener('click', toggleLanguage);
    }
}

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initI18n);
} else {
    initI18n();
}
