import { connectToWeightSocket } from './scaleConnection.js';
import { checkGoldMarketStatus, connectToGoldPriceWebSocket, fetchTokensFromSupabase, checkSubscription } from './livePriceConnection.js';
let selectedKarat = 18;
let currentWeight = 10.00;
let currentGoldPrice = 3400;
let selectedDesign = null;

let sessionTokens = null;
let sessionRefreshInterval = null;
let previousPrice = 1;
let manualWeight = null;

let isFluctuationEnabled = true; 

const DEFAULT_BUY_DISCOUNT = 20;
const DEFAULT_FLUCTUATION_RANGE = 1;
let goldMode = 'sell'; // 'sell' or 'buy'
const karatMultipliers = {
  24: 1.0,    
  21: 0.875,  
  18: 0.75    
};

const DEFAULT_DESIGN_FOR_KARAT = {
  18: 'ايطالي',
  21: 'محلي',
  24: 'محلي'
    };

// DOM elements
const currentWeightElement = document.getElementById('current-weight');

const connectionStatusElement = document.getElementById('connection-status');
const priceConnectionStatusElement = document.getElementById('price-connection-status');
const priceValueElement = document.getElementById('price-value');
const priceArrowElement = document.getElementById('price-arrow');
const priceCurrencyElement = document.getElementById('price-currency');




// Manual weight modal elements
const manualWeightBtn = document.getElementById('manual-weight-btn');
const manualWeightModal = document.getElementById('manual-weight-modal');
const manualWeightModalClose = document.getElementById('manual-weight-modal-close');
const manualWeightModalSave = document.getElementById('manual-weight-modal-save');
const manualWeightInput = document.getElementById('manual-weight-input');

// --- Details toggle logic ---
const toggleDetailsBtn = document.getElementById('toggle-details-btn');
const toggleDetailsIcon = document.getElementById('toggle-details-icon');
let detailsVisible = false;

// --- Stone Deduction Feature ---
let stoneDeduction = 0;

const netGoldWeightDisplay = document.getElementById('net-gold-weight-display');
const netGoldWeightValue = document.getElementById('net-gold-weight-value');
const stoneDeductionModal = document.getElementById('stone-deduction-modal');
const stoneDeductionModalClose = document.getElementById('stone-deduction-modal-close');
const stoneDeductionInput = document.getElementById('stone-deduction-input');
const stoneDeductionModalSave = document.getElementById('stone-deduction-modal-save');

function shouldShowStoneDeduction() {
  return goldMode === 'buy' && (selectedKarat === 18 || selectedKarat === 21);
}

function getNetGoldWeight() {
  let base = manualWeight !== null ? manualWeight : currentWeight;
  if (shouldShowStoneDeduction()) {
    return Math.max(0, base - stoneDeduction);
  }
  return base;
}

function updateStoneDeductionUI() {
  if (shouldShowStoneDeduction()) {
    netGoldWeightDisplay.style.display = 'block';
    netGoldWeightValue.textContent = getNetGoldWeight().toFixed(2);
  } else {
    netGoldWeightDisplay.style.display = 'none';
    stoneDeduction = 0;
  }
}


function updateDetailsVisibility() {
 
  const costPerGramBox = document.getElementById('detail-cost-per-gram');
  const vatBox = document.getElementById('detail-vat');
  if (goldMode === 'sell') {
    toggleDetailsBtn.style.display = 'block';
    if (detailsVisible) {
      toggleDetailsIcon.textContent = '❓';
      costPerGramBox.style.display = 'block';
      vatBox.style.display = 'block';
      updateDetailsRow();
    } else {
      toggleDetailsIcon.textContent = '❔';
      costPerGramBox.style.display = 'none';
      vatBox.style.display = 'none';
    }
  } else {
    toggleDetailsBtn.style.display = 'none';
    detailsVisible = false;
    costPerGramBox.style.display = 'none';
    vatBox.style.display = 'none';
  }
}

toggleDetailsBtn.onclick = function() {
  detailsVisible = !detailsVisible;
  updateDetailsVisibility();
};

// Remove insertDetailBoxes function

function updateDetailsRow() {
  if (!detailsVisible) return;
  const weightToUse = getEffectiveWeight();
  const manufacturingFee = getManufacturingFee(selectedKarat, selectedDesign, weightToUse);
  const price24K = (currentGoldPrice * 121.5) / 1000;
  const purityMultiplier = karatMultipliers[selectedKarat];
  const goldValueKarat = price24K * purityMultiplier;
  const taxRate = selectedKarat === 24 ? 1 : 1.15;
  const costPerGram = goldValueKarat + manufacturingFee;
  const totalBeforeTax = costPerGram * weightToUse;
  const vat = selectedKarat === 24 ? 0 : (totalBeforeTax * 0.15);
  const manufacturingFeeDetail = document.getElementById('manufacturing-fee-detail');
  const costPerGramDetail = document.getElementById('cost-per-gram-detail');
  const vatDetail = document.getElementById('vat-detail');
  if (manufacturingFeeDetail) manufacturingFeeDetail.textContent = manufacturingFee.toFixed(2);
  if (costPerGramDetail) costPerGramDetail.textContent = costPerGram.toFixed(2);
  if (vatDetail) vatDetail.textContent = vat.toFixed(2);
}


async function initializePriceConnection() {
  try {
    if (sessionRefreshInterval) clearInterval(sessionRefreshInterval);

    sessionTokens = await fetchTokensFromSupabase();
      if (sessionTokens?.status === "Expired") {
      document.getElementById("price-indicator").textContent = "انتهى الاشتراك.";
      updateConnectionStatus(priceConnectionStatusElement, false, "نرجوا تجديد الاشتراك");
      return; 
    }
    updateConnectionStatus(priceConnectionStatusElement, !!sessionTokens, sessionTokens ? 'حالة السعر: جلسة نشطة' : 'فشل تحميل الجلسة');
    if (!sessionTokens) throw new Error('فشل تحميل التوكنات من Supabase');

    const marketStatusResult = await checkGoldMarketStatus();

    if (marketStatusResult.status === "SESSION_EXPIRED") {
      console.warn("Session expired during market status check");
      sessionTokens = await fetchTokensFromSupabase();
      return initializePriceConnection();
    }

    if (marketStatusResult.status === "NO_SESSION" || marketStatusResult.status === "ERROR") {
      updateConnectionStatus(priceConnectionStatusElement, false, "حالة السوق: لا يمكن التأكد من حالة السوق");
      return;
    }

    if (marketStatusResult.status === "OPEN") {
      connectToGoldPriceWebSocket({
        onPriceUpdate: (realPrice) => {
          const fluctuationRange = getFluctuationRange();
          currentGoldPrice = isFluctuationEnabled ? addFluctuation(realPrice, fluctuationRange) : realPrice;
          console.log("Live Price:", currentGoldPrice);
          printRiyadhTime();
          updateMainPriceDisplay();
        },
        onStatusChange: (connected, message) => {
          updateConnectionStatus(priceConnectionStatusElement, connected, message);
        }
      });
    } else if (marketStatusResult.status === "CLOSED") {
      currentGoldPrice = marketStatusResult.bid;
      localStorage.setItem("offline_gold_price", currentGoldPrice);
      console.log("Market closed. Using static bid price:", currentGoldPrice);
      updateMainPriceDisplay();
      updateConnectionStatus(priceConnectionStatusElement, false, "حالة السوق: مغلق");
    }
  } catch (error) {
    console.error("Initialization failed:", error);
    updateConnectionStatus(priceConnectionStatusElement, false, 'حالة السعر: خطأ في الاتصال');
    setTimeout(initializePriceConnection, 5000);
  }
}

function addFluctuation(basePrice, range) {
  const fluctuation = (Math.random() * range * 2) - range;
  return basePrice + fluctuation;
}

// Remove the sarFormatter, and use en-US number formatting without currency

function updateMainPriceDisplay() {
  const weightToUse = getNetGoldWeight();
  if (weightToUse > 0 && currentGoldPrice > 0) {
    let finalPrice = 0;
    const buyDiscount = getBuyDiscount();
    const manufacturingFee = getManufacturingFee(selectedKarat, selectedDesign, weightToUse);
    if (goldMode === 'sell') {
      // Original sell logic
      const price24K = (currentGoldPrice * 121.5) / 1000;
      const purityMultiplier = karatMultipliers[selectedKarat];
      const goldValueKarat = price24K * purityMultiplier;
      const taxRate = selectedKarat === 24 ? 1 : 1.15;
      const manufacturingCost = (goldValueKarat + manufacturingFee) * weightToUse;
      finalPrice = manufacturingCost * taxRate;
    } else if (goldMode === 'buy') {
      // Buy logic: subtract buyDiscount SAR per gram from live price, then multiply by weight
      const price24K = (currentGoldPrice * 121.5) / 1000;
      const purityMultiplier = karatMultipliers[selectedKarat];
      const goldValueKarat = price24K * purityMultiplier;
      finalPrice = ( goldValueKarat - buyDiscount ) * weightToUse;
    }
    const difference = finalPrice - (previousPrice + 0.001);
    const color = difference < 0 ? '#F43F5E' : '#10B981';
    priceValueElement.textContent = finalPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    priceValueElement.style.color = color;
    priceValueElement.className = 'pricee';
    priceCurrencyElement.style.color = color;
    if (difference < 0) {
      priceArrowElement.innerHTML = '▼';
      priceArrowElement.className = 'arrow down';
    } else if (difference > 0) {
      priceArrowElement.innerHTML = '▲';
      priceArrowElement.className = 'arrow up';
    } else {
      priceArrowElement.innerHTML = '-';
      priceArrowElement.className = 'arrow';
    }
    previousPrice = finalPrice;
  } else {
    priceValueElement.textContent = '--.--';
    priceValueElement.className = 'price-placeholder';
    priceArrowElement.innerHTML = '-';
    priceArrowElement.className = 'arrow';
    priceCurrencyElement.style.color = '';
  }
  if (detailsVisible) updateDetailsRow();
    }



    // Select karat function
    function selectKarat(karat) {
      selectedKarat = karat;
      // Update active box
      document.querySelectorAll('.karat-box').forEach(function(box) {
        box.classList.remove('active');
      });
      document.getElementById('karat-' + karat).classList.add('active');
  // Set default design for this karat if needed
  const designs = getDesignsForKarat(selectedKarat);
  if (!selectedDesign || !designs.includes(selectedDesign)) {
    selectedDesign = DEFAULT_DESIGN_FOR_KARAT[selectedKarat] && designs.includes(DEFAULT_DESIGN_FOR_KARAT[selectedKarat])
      ? DEFAULT_DESIGN_FOR_KARAT[selectedKarat]
      : designs[1];
  }
  renderDesignSelector();
  updateAllUI();
    }
window.selectKarat = selectKarat;

    // Update connection status display
    function updateConnectionStatus(element, connected, message) {
      element.textContent = message;
      element.classList.remove(connected ? 'disconnected' : 'connected');
      element.classList.add(connected ? 'connected' : 'disconnected');
    }
    
window.setGoldMode = function(mode) {
  if (mode === 'buy' || mode === 'sell') {
    goldMode = mode;
    updateModeUI();
    updateAllUI();
    // Show/hide design type section
    const designTypeSection = document.getElementById('design-type-container');
    if (designTypeSection) {
      designTypeSection.style.display = (goldMode === 'sell') ? 'flex' : 'none';
    }
  }
};

function updateModeUI() {
  // Always show all karat options in both modes
  const karat24 = document.getElementById('karat-24');
  karat24.style.display = 'flex';
}

/*----------------------DEFAULT_MANUFACTURING_SETTINGS------------------------------*/ 

const DEFAULT_MANUFACTURING_SETTINGS = {
  "18": [
    {design: "ايطالي", from: 0, to: 0.50, fee: 800 },
    {design: "ايطالي", from: 0.51, to: 0.89, fee: 450 },
    {design: "ايطالي", from: 0.90, to: 1.00, fee: 250 },
    {design: "ايطالي", from: 1.01, to: 2, fee: 200 },
    {design: "ايطالي", from: 2.01, to: 3, fee: 175 },
    {design: "ايطالي", from: 3.01, to: 4, fee: 150 },
    {design: "ايطالي", from: 4.01, to: 5, fee: 125 },
    {design: "ايطالي", from: 5.01, to: 10, fee: 100 },
    {design: "محلي", from: 0, to: 0.5, fee: 850 },
    {design: "محلي", from: 0.51, to: 1, fee: 650 },
    {design: "محلي", from: 1.01, to: 2, fee: 180 },
    {design: "محلي", from: 2.01, to: 3, fee: 160 },
    {design: "محلي", from: 3.01, to: 4, fee: 130 },
    {design: "محلي", from: 4.01, to: 5, fee: 100 },
    {design: "محلي", from: 5.01, to: 10, fee: 80 },
  
  ],
  "21": [
    {design: "ايطالي", from: 0, to: 0.5, fee: 800 },
    {design: "ايطالي", from: 0.51, to: 1, fee: 650 },
    {design: "ايطالي", from: 1.01, to: 2, fee: 200 },
    {design: "ايطالي", from: 2.01, to: 3, fee: 175 },
    {design: "ايطالي", from: 3.01, to: 4, fee: 150 },
    {design: "ايطالي", from: 4.01, to: 5, fee: 125 },
    {design: "ايطالي", from: 5.01, to: 10, fee: 100 },
    {design: "محلي", from: 0, to: 0.5, fee: 850 },
    {design: "محلي", from: 0.51, to: 1, fee: 650 },
    {design: "محلي", from: 1.01, to: 2, fee: 180 },
    {design: "محلي", from: 2.01, to: 3, fee: 160 },
    {design: "محلي", from: 3.01, to: 4, fee: 130 },
    {design: "محلي", from: 4.01, to: 5, fee: 100 },
    {design: "محلي", from: 5.01, to: 10, fee: 80 },
    {design: "غوايش", from: 0, to: 100, fee: 40 }
  ],
  "24": [
    { design:"محلي", from: 0.98, to: 2.50, fee: 100 },
    { design:"محلي", from: 2.51, to: 5, fee: 80 },
    { design:"سويسري", from: 0.98, to: 2.50, fee: 150 },
    { design:"سويسري", from: 2.51, to: 5, fee: 130 },
  ]
};


let manufacturingSettings = loadManufacturingSettings();

function loadManufacturingSettings() {
  const saved = localStorage.getItem('goldManufacturingSettings');
  return saved ? JSON.parse(saved) : {...DEFAULT_MANUFACTURING_SETTINGS};
}

function saveManufacturingSettings() {
  localStorage.setItem('goldManufacturingSettings', JSON.stringify(manufacturingSettings));
}

function getDesignsForKarat(karat) {
  const ranges = manufacturingSettings[karat.toString()] || [];
  // Unique designs for this karat
  return [...new Set(ranges.map(r => r.design))];
}

function renderDesignSelector() {
  const container = document.getElementById('design-type-container');
  if (!container) return;
  // Hide if not in sell mode
  container.style.display = (goldMode === 'sell') ? 'flex' : 'none';
  const designs = getDesignsForKarat(selectedKarat);
  container.innerHTML = '';
  designs.forEach(design => {
    const btn = document.createElement('div');
    btn.className = 'design-type-box' + (selectedDesign === design ? ' active' : '');
    btn.textContent = design;
    btn.onclick = function() {
      selectedDesign = design;
      renderDesignSelector();
      updateAllUI();
    };
    container.appendChild(btn);
  });
}

function getManufacturingFee(karat, design, weight) {
  const ranges = manufacturingSettings[karat.toString()] || [];
  for (const range of ranges) {
    if (range.design === design && weight >= range.from && weight <= range.to) {
      return range.fee;
    }
  }
  // fallback: last fee for design or 0
  const last = ranges.filter(r => r.design === design).slice(-1)[0];
  return last ? last.fee : 0;
}

function getBuyDiscount() {
  const saved = localStorage.getItem('buyDiscount');
  return saved !== null ? parseFloat(saved) : DEFAULT_BUY_DISCOUNT;
}

function getFluctuationRange() {
  const saved = localStorage.getItem('fluctuationRange');
  return saved !== null ? parseFloat(saved) : DEFAULT_FLUCTUATION_RANGE;
}

// Remove all zircon deduction related code, variables, functions, and UI updates

if (manualWeightBtn) {
  manualWeightBtn.onclick = function() {
    if (manualWeight !== null) {
      // If already in manual mode, switch back to live mode
      manualWeight = null;
      updateAllUI();
      // Close modal if open
      if (manualWeightModal) manualWeightModal.style.display = 'none';
    } else {
      // Enter manual mode
      manualWeightModal.style.display = 'flex';
      manualWeightInput.value = '';
      manualWeightInput.focus();
    }
  };
}
if (manualWeightModalClose) {
  manualWeightModalClose.onclick = function() {
    manualWeightModal.style.display = 'none';
  };
}
if (manualWeightModalSave) {
  manualWeightModalSave.onclick = function() {
    let val = parseFloat(manualWeightInput.value);
    if (!isNaN(val) && val >= 0) {
      manualWeight = val;
      manualWeightModal.style.display = 'none';
      updateAllUI();
    }
  };
}
// Remove clear button if present
if (manualWeightModal) {
  let clearBtn = manualWeightModal.querySelector('#manual-weight-modal-clear');
  if (clearBtn) clearBtn.remove();
}
manualWeightInput && (manualWeightInput.onkeydown = function(e) {
  if (e.key === 'Enter') manualWeightModalSave.click();
});
window.addEventListener('click', function(e) {
  if (manualWeightModal.style.display === 'flex' && e.target === manualWeightModal) {
    manualWeightModal.style.display = 'none';
  }
});

if (stoneDeductionModalSave) {
  stoneDeductionModalSave.onclick = function() {
    let val = Math.max(0, parseFloat(stoneDeductionInput.value) || 0);
    let base = manualWeight !== null ? manualWeight : currentWeight;
    if (val > base) val = base;
    stoneDeduction = val;
    stoneDeductionModal.style.display = 'none';
    updateAllUI();
  };
}
if (stoneDeductionModalClose) {
  stoneDeductionModalClose.onclick = function() {
    stoneDeductionModal.style.display = 'none';
  };
}
if (stoneDeductionInput) {
  stoneDeductionInput.onkeydown = function(e) {
    if (e.key === 'Enter') stoneDeductionModalSave.click();
  };
}
window.addEventListener('click', function(e) {
  if (stoneDeductionModal.style.display === 'flex' && e.target === stoneDeductionModal) {
    stoneDeductionModal.style.display = 'none';
  }
});

// Use manualWeight in calculations if set
function getEffectiveWeight() {
  let base = manualWeight !== null ? manualWeight : currentWeight;
  return base;
}

// Update the weight display to show manual or live weight and update the icon
function updateWeightDisplay() {
  const weight = manualWeight !== null ? manualWeight : currentWeight;
  const modeIcon = document.getElementById('weight-mode-icon');
  if (manualWeight !== null) {
    currentWeightElement.textContent = manualWeight.toFixed(2);
    currentWeightElement.style.color = '#d97706';
    if (modeIcon) modeIcon.textContent = '✎';
  } else {
    currentWeightElement.textContent = currentWeight.toFixed(2);
    currentWeightElement.style.color = '';
    if (modeIcon) modeIcon.textContent = '⚖️';
  }
  // Update net gold weight
  if (shouldShowStoneDeduction()) {
    netGoldWeightValue.textContent = getNetGoldWeight().toFixed(2);
  }
}

// Patch into all relevant UI updates
function updateAllUI() {
  updateWeightDisplay();
  updateMainPriceDisplay();
  updateDetailsVisibility();
  updateStoneDeductionUI();
}

function printRiyadhTime() {
  const now = new Date();
  const riyadhTime = now.toLocaleString('en-US', { timeZone: 'Asia/Riyadh', hour12: false });
  console.log('Riyadh Time:', riyadhTime);
}

if (netGoldWeightValue) {
  netGoldWeightValue.onclick = function() {
    stoneDeductionModal.style.display = 'flex';
    stoneDeductionInput.value = stoneDeduction || '';
    stoneDeductionInput.focus();
  };
}
async function getInjectMacAddress() {
  try {
    const res = await fetch("/info");
    if (!res.ok) throw new Error("فشل في الاتصال بـ /info");

    const data = await res.json();
    const mac = data.mac;

    if (mac) {
      document
        .querySelector('meta[name="device-mac"]')
        .setAttribute("content", mac);
      return true;
    } else {
      console.warn("لم يتم العثور على MAC في الرد");
      return null;
    }
  } catch (error) {
    console.error("خطأ أثناء جلب MAC:", error);
    return null;
  }
}



document.addEventListener('DOMContentLoaded', function() {
  getInjectMacAddress();
  selectKarat(18); 
  connectToWeightSocket({
    onWeightUpdate: (weight) => {
            currentWeight = weight;
            currentWeightElement.textContent = currentWeight.toFixed(2);
      updateAllUI();
    },
    onStatusChange: (connected, message) => {
      updateConnectionStatus(connectionStatusElement, connected, message);
    }
  });
  initializePriceConnection();
  updateModeUI();
  renderDesignSelector(); 
  updateAllUI();
  checkSubscription(document.querySelector('meta[name="device-mac"]').getAttribute("content"))
    .then(isSubscribed => {
      if (!isSubscribed) {
        updateConnectionStatus(priceConnectionStatusElement, false, "الجهاز غير مشترك");
        document.getElementById("price-indicator").textContent = "انتهى الاشتراك.";
      } else {
        updateConnectionStatus(priceConnectionStatusElement, true, "الجهاز مشترك");
      }
    })
    .catch(error => {
      console.error("Subscription check failed:", error);
      updateConnectionStatus(priceConnectionStatusElement, false, "فشل في التحقق من الاشتراك");
      document.getElementById("price-indicator").textContent = "فشل في التحقق من الاشتراك.";
    });

  if (currentWeightElement) {
    currentWeightElement.onclick = function() {
      let valueToInject = manualWeight !== null ? manualWeight : currentWeight;
      manualWeightInput.value = (valueToInject !== 0) ? valueToInject : '';    
      manualWeightModal.style.display = 'flex';
      manualWeightInput.focus();
        };
  }

  const weightLabel = document.getElementById('weight-label');
  if (weightLabel) {
    weightLabel.onclick = function() {
      if (manualWeight !== null) {
        manualWeight = null;
      } else {
        manualWeight = parseFloat(currentWeightElement.textContent) || 0;
      }
      updateAllUI();
    };
    }

      const modeSellBtn = document.getElementById('mode-sell');
      const modeBuyBtn = document.getElementById('mode-buy');
      modeSellBtn.addEventListener('click', function() {
        modeSellBtn.classList.add('active');
        modeBuyBtn.classList.remove('active');
        window.setGoldMode && window.setGoldMode('sell');
      });
      modeBuyBtn.addEventListener('click', function() {
        modeBuyBtn.classList.add('active');
        modeSellBtn.classList.remove('active');
        window.setGoldMode && window.setGoldMode('buy');
      });

        const savedTheme = localStorage.getItem('theme');
    
    if (savedTheme) {
      if (savedTheme === 'dark') {
       document.documentElement.classList.add('dark-theme');
      } else {
        document.documentElement.classList.remove('dark-theme');
      }
    } else {
      localStorage.setItem('theme', 'light');
    }

});
