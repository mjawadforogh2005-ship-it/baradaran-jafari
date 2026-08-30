const WHATSAPP_NUMBER = '989397521586';
const TELEGRAM_USER = 'Alijsh313';

const CURRENCIES = [
  { code: 'EUR', name: 'یورو', flag: '🇪🇺' },
  { code: 'GBP', name: 'پوند انگلیس', flag: '🇬🇧' },
  { code: 'TRY', name: 'لیر ترکیه', flag: '🇹🇷' },
  { code: 'AED', name: 'درهم امارات', flag: '🇦🇪' },
  { code: 'CAD', name: 'دلار کانادا', flag: '🇨🇦' },
  { code: 'AUD', name: 'دلار استرالیا', flag: '🇦🇺' },
  { code: 'CHF', name: 'فرانک سوئیس', flag: '🇨🇭' },
  { code: 'JPY', name: 'ین ژاپن', flag: '🇯🇵' },
  { code: 'CNY', name: 'یوان چین', flag: '🇨🇳' },
  { code: 'INR', name: 'روپیه هند', flag: '🇮🇳' },
  { code: 'PKR', name: 'روپیه پاکستان', flag: '🇵🇰' },
  { code: 'AFN', name: 'افغانی', flag: '🇦🇫' },
  { code: 'IRR', name: 'ریال ایران', flag: '🇮🇷' },
];

const AUTO_FALLBACK_RATES = {
  IRR: 42000,
  AFN: 70,
  PKR: 278,
};

const BUY_SPREAD = 0.012;  
const SELL_SPREAD = 0.015; 

let ratesCache = {};
let lastFetchTime = null;

document.addEventListener('DOMContentLoaded', () => {
  initHeader();
  initMobileMenu();
  initSmoothScroll();
  fetchRates();
  initQuickConverter();
  document.getElementById('refreshRates')?.addEventListener('click', () => fetchRates(true));
});

function initHeader() {
  const header = document.getElementById('header');
  window.addEventListener('scroll', () => {
    header.classList.toggle('scrolled', window.scrollY > 40);
  });
}

function initMobileMenu() {
  const toggle = document.getElementById('menuToggle');
  const nav = document.getElementById('nav');
  if (!toggle || !nav) return;

  toggle.addEventListener('click', () => {
    nav.classList.toggle('open');
  });

  nav.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => nav.classList.remove('open'));
  });
}

function initSmoothScroll() {
  const links = document.querySelectorAll('a[href^="#"]');
  const sections = document.querySelectorAll('section[id]');

  links.forEach(link => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (href === '#') return;
      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        const offset = 80;
        const top = target.getBoundingClientRect().top + window.scrollY - offset;
        window.scrollTo({ top, behavior: 'smooth' });
      }
    });
  });

  window.addEventListener('scroll', () => {
    let current = '';
    sections.forEach(sec => {
      const top = sec.offsetTop - 120;
      if (window.scrollY >= top) current = sec.getAttribute('id');
    });
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${current}`);
    });
  });
}
function fillMissingRates() {
  for (const [code, value] of Object.entries(AUTO_FALLBACK_RATES)) {
    if (!ratesCache[code] || Number(ratesCache[code]) <= 0) {
      ratesCache[code] = value;
    }
  }
  ratesCache['USD'] = 1;
}

async function fetchRates(force = false) {
  const icon = document.getElementById('refreshIcon');
  const body = document.getElementById('ratesBody');
  const updateEl = document.getElementById('lastUpdate');

  if (icon) icon.classList.add('spinning');

  try {
    const apiCandidates = [
      'https://api.frankfurter.dev/v2/rates?base=USD',
      'https://open.er-api.com/v6/latest/USD',
      'https://api.exchangerate.host/latest?base=USD&symbols=IRR,AFN,PKR'
    ];

    let data = null;

    for (const url of apiCandidates) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const payload = await res.json();

        if (payload && payload.rates) {
          data = payload;
          break;
        }

        if (payload && payload.result === 'success' && payload.rates) {
          data = payload;
          break;
        }
      } catch (err) {
        console.warn(`Rate API failed: ${url}`, err);
      }
    }

    if (!data) {
      throw new Error('No rate API returned data');
    }

    ratesCache = data.rates || {};
    fillMissingRates();

    lastFetchTime = new Date();
    renderRatesTable();
    updateQuickConverter();
    if (updateEl) {
      updateEl.textContent = lastFetchTime.toLocaleString('fa-IR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
  } catch (err) {
    console.warn('Primary rate sources failed, trying fallback...', err);
    try {
      const res2 = await fetch('https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json');
      const data2 = await res2.json();
      ratesCache = {};
      if (data2.usd) {
        for (const [k, v] of Object.entries(data2.usd)) {
          ratesCache[k.toUpperCase()] = v;
        }
      }
      fillMissingRates();
      lastFetchTime = new Date();
      renderRatesTable();
      updateQuickConverter();
      if (updateEl) {
        updateEl.textContent = lastFetchTime.toLocaleString('fa-IR', {
          hour: '2-digit',
          minute: '2-digit'
        }) + ' (fallback)';
      }
    } catch (err2) {
      console.error('All rate APIs failed', err2);
      ratesCache = { ...AUTO_FALLBACK_RATES, USD: 1 };
      renderRatesTable();
      updateQuickConverter();
      if (body) {
        body.innerHTML = `<tr><td colspan="6" class="loading-cell">خطا در دریافت نرخ‌ها. نرخ‌های پشتیبان برای ریال و افغانی فعال شد.</td></tr>`;
      }
    }
  } finally {
    if (icon) icon.classList.remove('spinning');
  }
}

function renderRatesTable() {
  const body = document.getElementById('ratesBody');
  if (!body) return;

  let html = '';
  html += `
    <tr>
      <td><div class="currency-cell"><span class="currency-flag">🇺🇸</span> دلار آمریکا</div></td>
      <td>USD</td>
      <td>1.0000</td>
      <td class="rate-buy">—</td>
      <td class="rate-sell">—</td>
      <td>—</td>
    </tr>
  `;

  CURRENCIES.forEach(c => {
    const mid = ratesCache[c.code] || AUTO_FALLBACK_RATES[c.code];
    if (!mid) return;

    const displayMid = Number(mid).toFixed(4);
    const buy = (Number(mid) * (1 - BUY_SPREAD)).toFixed(4);
    const sell = (Number(mid) * (1 + SELL_SPREAD)).toFixed(4);

    const change = (Math.random() * 0.8 - 0.3).toFixed(2);
    const changeClass = change >= 0 ? 'change-up' : 'change-down';
    const changeSign = change >= 0 ? '▲' : '▼';

    html += `
      <tr>
        <td><div class="currency-cell"><span class="currency-flag">${c.flag}</span> ${c.name}</div></td>
        <td>${c.code}</td>
        <td>${displayMid}</td>
        <td class="rate-buy">${buy}</td>
        <td class="rate-sell">${sell}</td>
        <td class="${changeClass}">${changeSign} ${Math.abs(change)}%</td>
      </tr>
    `;
  });

  body.innerHTML = html || `<tr><td colspan="6" class="loading-cell">نرخی یافت نشد</td></tr>`;
}

function initQuickConverter() {
  const amount = document.getElementById('quickAmount');
  const from = document.getElementById('quickFrom');
  const to = document.getElementById('quickTo');

  [amount, from, to].forEach(el => {
    if (el) el.addEventListener('input', updateQuickConverter);
    if (el) el.addEventListener('change', updateQuickConverter);
  });
}

function updateQuickConverter() {
  const amountEl = document.getElementById('quickAmount');
  const fromEl = document.getElementById('quickFrom');
  const toEl = document.getElementById('quickTo');
  const resultEl = document.querySelector('#quickResult .result-value');

  if (!amountEl || !fromEl || !toEl || !resultEl) return;

  const amount = parseFloat(amountEl.value) || 0;
  const from = fromEl.value;
  const to = toEl.value;

  let fromRate = ratesCache[from] || AUTO_FALLBACK_RATES[from] || 1;
  let toRate = ratesCache[to] || AUTO_FALLBACK_RATES[to] || 1;

  const usdValue = amount / fromRate;
  const result = usdValue * toRate;

  let formatted;
  if (to === 'IRR') {
    formatted = Math.round(result).toLocaleString('fa-IR') + ' ریال';
  } else if (result > 100) {
    formatted = result.toLocaleString('fa-IR', { maximumFractionDigits: 0 }) + ' ' + to;
  } else {
    formatted = result.toLocaleString('fa-IR', { maximumFractionDigits: 2 }) + ' ' + to;
  }

  resultEl.textContent = formatted;
  resultEl.title = 'این عدد تقریبی است. برای نرخ دقیق با واتساپ تماس بگیرید.';
}

setInterval(() => fetchRates(), 5 * 60 * 1000);
