// === SHOPIFY MARKETS CURRENCY PRICE UPDATER ===
(function() {
const priceMap = {
  'EUR': { 40: '€40', 60: '€60', 70: '€70', 100: '€100', 120: '€120', 150: '€150' },
  'GBP': { 40: '£35', 60: '£52', 70: '£60', 100: '£86', 120: '£103', 150: '£129' },
  'ISK': { 40: 'kr 5,940', 60: 'kr 8,900', 70: 'kr 10,395', 100: 'kr 14,850', 120: 'kr 17,800', 150: 'kr 22,250' },
  'CAD': { 40: 'C$65', 60: 'C$97', 70: 'C$113', 100: 'C$162', 120: 'C$194', 150: 'C$243' },
  'CHF': { 40: 'CHF 37', 60: 'CHF 56', 70: 'CHF 65', 100: 'CHF 93', 120: 'CHF 112', 150: 'CHF 140' },
  'DKK': { 40: 'kr 299', 60: 'kr 448', 70: 'kr 523', 100: 'kr 747', 120: 'kr 896', 150: 'kr 1,121' },
  'SEK': { 40: 'kr 435', 60: 'kr 653', 70: 'kr 762', 100: 'kr 1,089', 120: 'kr 1,307', 150: 'kr 1,634' },
  'NOK': { 40: 'kr 476', 60: 'kr 713', 70: 'kr 832', 100: 'kr 1,189', 120: 'kr 1,427', 150: 'kr 1,784' },
  'HUF': { 40: 'Ft 15,500', 60: 'Ft 23,300', 70: 'Ft 27,200', 100: 'Ft 38,800', 120: 'Ft 46,500', 150: 'Ft 58,200' },
  'CZK': { 40: 'Kč 974', 60: 'Kč 1,460', 70: 'Kč 1,704', 100: 'Kč 2,434', 120: 'Kč 2,921', 150: 'Kč 3,651' },
  'PLN': { 40: 'zł 168', 60: 'zł 252', 70: 'zł 294', 100: 'zł 420', 120: 'zł 504', 150: 'zł 630' },
  'RON': { 40: '203 lei', 60: '305 lei', 70: '356 lei', 100: '509 lei', 120: '611 lei', 150: '764 lei' },
  'BGN': { 40: '78 лв', 60: '117 лв', 70: '137 лв', 100: '196 лв', 120: '235 лв', 150: '293 лв' }
};

  let isUpdating = false;

  function getCurrency() {
    if (window.Shopify?.currency?.active) return window.Shopify.currency.active;

    const input = document.querySelector('input[name="country_code"]');
    if (!input?.value) return 'EUR';

    const map = { 
      'GB': 'GBP', 
      'IS': 'ISK', 
      'CA': 'CAD', 
      'CH': 'CHF', 
      'DK': 'DKK', 
      'SE': 'SEK', 
      'NO': 'NOK', 
      'HU': 'HUF',
      'CZ': 'CZK',
      'PL': 'PLN',
      'RO': 'RON',  
      'BG': 'BGN'   
    };
    return map[input.value] || 'EUR';
  }

  function replacePrices(text, prices) {
    return text
      .replace(/€\s?150|150\s?€/gi, prices[150])
      .replace(/€\s?120|120\s?€/gi, prices[120])
      .replace(/€\s?100|100\s?€/gi, prices[100])
      .replace(/€\s?70|70\s?€/gi, prices[70])
      .replace(/€\s?60|60\s?€/gi, prices[60])
      .replace(/€\s?40|40\s?€/gi, prices[40]);
  }

  function updatePrices() {
    if (isUpdating) return;
    
    const currency = getCurrency();
    
    if (currency === 'EUR') return;
    
    isUpdating = true;

    const prices = priceMap[currency];

    document.querySelectorAll('.announcement-bar__static-list p, announcement-bar p').forEach(p => {
      const newText = replacePrices(p.textContent, prices);
      if (p.textContent !== newText) {
        p.textContent = newText;
      }
    });

    document.querySelectorAll('.product-info__block-item[data-block-type="offer"] .prose li').forEach(li => {
      const newHtml = replacePrices(li.innerHTML, prices);
      if (li.innerHTML !== newHtml) {
        li.innerHTML = newHtml;
      }
    });

    isUpdating = false;
  }

  function debounce(fn, delay) {
    let timeout;
    return function() {
      clearTimeout(timeout);
      timeout = setTimeout(fn, delay);
    };
  }

  const debouncedUpdate = debounce(updatePrices, 100);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updatePrices);
  } else {
    updatePrices();
  }

  document.addEventListener('click', e => {
    if (e.target.closest('[data-disclosure-option], .localization-selector')) {
      setTimeout(updatePrices, 200);
    }
  });

  document.addEventListener('currency.change', updatePrices);

  const observer = new MutationObserver(debouncedUpdate);
  observer.observe(document.body, { childList: true, subtree: true });

})();