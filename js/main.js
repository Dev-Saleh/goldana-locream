/**
 * Main Application Logic for Gold Calculator
 * 
 * This module handles the core functionality of the gold price calculator including:
 * - Real-time price calculations and display
 * - Weight management (manual and scale input)
 * - Karat and design selection
 * - Buy/sell mode switching
 * - Stone deduction for buy mode
 * - UI state management
 */

// External module imports
import { connectToWeightSocket } from './scaleConnection.js';
import { checkGoldMarketStatus, connectToGoldPriceWebSocket, fetchTokensFromSupabase, checkSubscription } from './livePriceConnection.js';
import { DEFAULT_MANUFACTURING_SETTINGS, DEFAULT_DESIGN_FOR_KARAT, KARAT_MULTIPLIERS } from './manufacturingDefaults.js';
import { StorageManager } from './storageUtils.js';
// ============================================================================
// APPLICATION STATE
// ============================================================================

// Core calculation variables
let selectedKarat = 18;
let currentWeight = 10.00;
let currentGoldPrice = 3400;
let selectedDesign = null;
let goldMode = 'sell'; // 'sell' or 'buy'

// Price connection state
let sessionTokens = null;
let sessionRefreshInterval = null;
let previousPrice = 1;
let isFluctuationEnabled = true;

// Weight management
let manualWeight = null;

// Stone deduction for buy mode
let stoneDeduction = 0;

// UI state
let detailsVisible = false;

// Manufacturing settings loaded from storage
let manufacturingSettings = loadManufacturingSettings();

// ============================================================================
// DOM ELEMENT REFERENCES
// ============================================================================

// Weight display elements
const currentWeightElement = document.getElementById('current-weight');
const netGoldWeightDisplay = document.getElementById('net-gold-weight-display');
const netGoldWeightValue = document.getElementById('net-gold-weight-value');

// Connection status elements
const connectionStatusElement = document.getElementById('connection-status');
const priceConnectionStatusElement = document.getElementById('price-connection-status');
const subscribtionStatusElement = document.getElementById('subscribtion-status');

// Price display elements
const priceValueElement = document.getElementById('price-value');
const priceArrowElement = document.getElementById('price-arrow');
const priceCurrencyElement = document.getElementById('price-currency');

// Manual weight modal elements
const manualWeightBtn = document.getElementById('manual-weight-btn');
const manualWeightModal = document.getElementById('manual-weight-modal');
const manualWeightModalClose = document.getElementById('manual-weight-modal-close');
const manualWeightModalSave = document.getElementById('manual-weight-modal-save');
const manualWeightInput = document.getElementById('manual-weight-input');

// Stone deduction modal elements
const stoneDeductionModal = document.getElementById('stone-deduction-modal');
const stoneDeductionModalClose = document.getElementById('stone-deduction-modal-close');
const stoneDeductionInput = document.getElementById('stone-deduction-input');
const stoneDeductionModalSave = document.getElementById('stone-deduction-modal-save');

// UI toggle elements
const toggleDetails = document.getElementById('toggle-details');
const toggleStatus = document.getElementById('toggle-status');
const toggleDocument = document.getElementById('toggle-document');

// ============================================================================
// STONE DEDUCTION FUNCTIONS
// ============================================================================

/**
 * Check if stone deduction should be shown based on current mode and karat
 * @returns {boolean} True if stone deduction should be visible
 */
function shouldShowStoneDeduction() {
  return goldMode === 'buy' && (selectedKarat === 18 || selectedKarat === 21);
}

/**
 * Calculate the net gold weight after stone deduction
 * @returns {number} Net gold weight in grams
 */
function getNetGoldWeight() {
  const baseWeight = manualWeight !== null ? manualWeight : currentWeight;
  if (shouldShowStoneDeduction()) {
    return Math.max(0, baseWeight - stoneDeduction);
  }
  return baseWeight;
}

/**
 * Update the stone deduction UI visibility and values
 */
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
    toggleDetails.style.display = 'block';
    if (detailsVisible) {
      costPerGramBox.style.display = 'block';
      vatBox.style.display = 'block';
      updateDetailsRow();
    } else {
      costPerGramBox.style.display = 'none';
      vatBox.style.display = 'none';
    }
  } else {
    toggleDetails.style.display = 'block';
    detailsVisible = false;
    costPerGramBox.style.display = 'none';
    vatBox.style.display = 'none';
  }
}

toggleDetails.onclick = function() {
  detailsVisible = !detailsVisible;
  updateDetailsVisibility();
};
toggleStatus.onclick = function() {
  toggleStatus.style.display = 'none';
}
toggleDocument.onclick = function() {
  toggleDocument.style.display = 'none';
}

function updateDetailsRow() {
  if (!detailsVisible) return;
  const weightToUse = getEffectiveWeight();
  const manufacturingFee = getManufacturingFee(selectedKarat, selectedDesign, weightToUse);
  const price24K = (currentGoldPrice * 121.5) / 1000;
  const purityMultiplier = KARAT_MULTIPLIERS[selectedKarat];
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
      updateStatus(subscribtionStatusElement, false, "نرجوا تجديد الاشتراك");
      return; 
    }
    updateStatus(priceConnectionStatusElement, !!sessionTokens, sessionTokens ? 'حالة السعر: جلسة نشطة' : 'فشل تحميل الجلسة');
    if (!sessionTokens) throw new Error('فشل تحميل التوكنات من Supabase');

    const marketStatusResult = await checkGoldMarketStatus();

    if (marketStatusResult.status === "SESSION_EXPIRED") {
      console.warn("Session expired during market status check");
      sessionTokens = await fetchTokensFromSupabase();
      return initializePriceConnection();
    }

    if (marketStatusResult.status === "NO_SESSION" || marketStatusResult.status === "ERROR") {
      updateStatus(priceConnectionStatusElement, false, "حالة البورصة: لا يمكن التأكد من حالة البورصة");
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
          updateStatus(priceConnectionStatusElement, connected, message);
        }
      });
    } else if (marketStatusResult.status === "CLOSED") {
      currentGoldPrice = marketStatusResult.bid;
      localStorage.setItem("offline_gold_price", currentGoldPrice);
      console.log("Market closed. Using static bid price:", currentGoldPrice);
      updateMainPriceDisplay();
      updateStatus(priceConnectionStatusElement, false, "حالة البورصة: مغلق");
    }
  } catch (error) {
    console.error("Initialization failed:", error);
    updateStatus(priceConnectionStatusElement, false, 'حالة السعر: خطأ في الاتصال');
    setTimeout(initializePriceConnection, 5000);
  }
}

function addFluctuation(basePrice, range) {
  const fluctuation = (Math.random() * range * 2) - range;
  return basePrice + fluctuation;
}

// Remove the sarFormatter, and use en-US number formatting without currency

// ============================================================================
// PRICE CALCULATION AND DISPLAY
// ============================================================================

/**
 * Calculate and update the main price display
 * Handles both sell and buy modes with different calculation logic
 */
function updateMainPriceDisplay() {
  const weightToUse = getNetGoldWeight();
  
  if (weightToUse > 0 && currentGoldPrice > 0) {
    let finalPrice = 0;
    const buyDiscount = getBuyDiscount();
    const manufacturingFee = getManufacturingFee(selectedKarat, selectedDesign, weightToUse);
    
    updateCostPerGramDisplay();
    
    if (goldMode === 'sell') {
      finalPrice = calculateSellPrice(weightToUse, manufacturingFee);
    } else if (goldMode === 'buy') {
      finalPrice = calculateBuyPrice(weightToUse, buyDiscount);
    }
    
    updatePriceDisplay(finalPrice);
    previousPrice = finalPrice;
  } else {
    displayPlaceholderPrice();
  }
  
  if (detailsVisible) updateDetailsRow();
}

/**
 * Calculate sell price based on weight and manufacturing fee
 * @param {number} weight - Weight in grams
 * @param {number} manufacturingFee - Manufacturing fee per gram
 * @returns {number} Final sell price
 */
function calculateSellPrice(weight, manufacturingFee) {
  const price24K = (currentGoldPrice * 121.5) / 1000;
  const purityMultiplier = KARAT_MULTIPLIERS[selectedKarat];
  const goldValueKarat = price24K * purityMultiplier;
  const taxRate = selectedKarat === 24 ? 1 : 1.15;
  
  let manufacturingCost;
  if (weight < 1.00) {
    // For weights under 1g: fixed fee logic
    manufacturingCost = goldValueKarat * weight + manufacturingFee;
  } else {
    // For weights 1g and above: per gram fee logic
    manufacturingCost = (goldValueKarat + manufacturingFee) * weight;
  }
  
  return manufacturingCost * taxRate;
}

/**
 * Calculate buy price based on weight and discount
 * @param {number} weight - Weight in grams
 * @param {number} buyDiscount - Buy discount per gram
 * @returns {number} Final buy price
 */
function calculateBuyPrice(weight, buyDiscount) {
  const price24K = (currentGoldPrice * 121.5) / 1000;
  const purityMultiplier = KARAT_MULTIPLIERS[selectedKarat];
  const goldValueKarat = price24K * purityMultiplier;
  
  return (goldValueKarat - buyDiscount) * weight;
}

/**
 * Update the price display elements with the calculated price
 * @param {number} finalPrice - The calculated final price
 */
function updatePriceDisplay(finalPrice) {
  const difference = finalPrice - (previousPrice + 0.001);
  const color = difference < 0 ? '#F43F5E' : '#10B981';
  
  priceValueElement.textContent = finalPrice.toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
  priceValueElement.style.color = color;
  priceValueElement.className = 'pricee';
  priceCurrencyElement.style.color = color;
  
  // Update price direction arrow
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
}

/**
 * Display placeholder when price cannot be calculated
 */
function displayPlaceholderPrice() {
  priceValueElement.textContent = '--.--';
  priceValueElement.className = 'price-placeholder';
  priceArrowElement.innerHTML = '-';
  priceArrowElement.className = 'arrow';
  priceCurrencyElement.style.color = '';
}



// ============================================================================
// KARAT AND DESIGN MANAGEMENT
// ============================================================================

/**
 * Select a karat level and update the UI accordingly
 * @param {number} karat - The karat level to select (18, 21, 24)
 */
function selectKarat(karat) {
  selectedKarat = karat;
  
  // Update active karat box styling
  document.querySelectorAll('.karat-box').forEach(function(box) {
    box.classList.remove('active');
  });
  document.getElementById('karat-' + karat).classList.add('active');
  
  // Set default design for this karat if needed
  const designs = getDesignsForKarat(selectedKarat);
  if (!selectedDesign || !designs.includes(selectedDesign)) {
    selectedDesign = DEFAULT_DESIGN_FOR_KARAT[selectedKarat] && designs.includes(DEFAULT_DESIGN_FOR_KARAT[selectedKarat])
      ? DEFAULT_DESIGN_FOR_KARAT[selectedKarat]
      : designs[0];
  }
  
  renderDesignSelector();
  updateAllUI();
}
window.selectKarat = selectKarat;

    // Update connection status display
    function updateStatus(element, connected, message) {
      element.textContent = message;
      element.classList.remove(connected ? 'disconnected' : 'connected');
      element.classList.add(connected ? 'connected' : 'disconnected');
    }
    
window.setGoldMode = function(mode) {
  if (mode === 'buy' || mode === 'sell') {
    goldMode = mode;
    updateModeUI();
    updateAllUI();
    
    // Update price display border color based on mode
    const priceDisplay = document.getElementById('mode-toggle');
    if (priceDisplay) {
      if (goldMode === 'sell') {
        priceDisplay.style.borderColor = 'var(--border-sell-mode)';
      } else if (goldMode === 'buy') {
        priceDisplay.style.borderColor = 'var(--border-buy-mode)';
      }
    }
    
    // Show/hide design type section
    const designTypeSection = document.getElementById('design-type-container');
    if (designTypeSection) {
      // designTypeSection.style.display = (goldMode === 'sell') ? 'flex' : 'none';
      designTypeSection.style.pointerEvents = (goldMode === 'sell') ? '' : "none";
      designTypeSection.style.opacity = (goldMode === 'sell')  ? "1" : "0.1";
    }
  }
};

function updateModeUI() {
  // Always show all karat options in both modes
  const karat24 = document.getElementById('karat-24');
  karat24.style.display = 'flex';
}

// ============================================================================
// STORAGE FUNCTIONS
// ============================================================================

/**
 * Load manufacturing settings from storage
 * @returns {Object} Manufacturing settings object
 */
function loadManufacturingSettings() {
  return StorageManager.getManufacturingSettings({...DEFAULT_MANUFACTURING_SETTINGS});
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
  container.style.pointerEvents = (goldMode === 'sell') ? '' : "none";
  container.style.opacity = (goldMode === 'sell')  ? "1" : "0.1";
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
  // Apply fixed fee for weights under 1.00g
  if (weight < 1.00) {
    return getFixedManufacturingFee();
  }
  
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

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get buy discount value from storage
 * @returns {number} Buy discount in SAR per gram
 */
function getBuyDiscount() {
  return StorageManager.getBuyDiscount();
}

/**
 * Get fluctuation range from storage
 * @returns {number} Fluctuation range value
 */
function getFluctuationRange() {
  return StorageManager.getFluctuationRange();
}

/**
 * Get fixed manufacturing fee from storage
 * @returns {number} Fixed manufacturing fee in SAR
 */
function getFixedManufacturingFee() {
  return StorageManager.getFixedManufacturingFee();
}

/**
 * Get Commercial Registration number from storage
 * @returns {string} CR number
 */
function getCRNumber() {
  return StorageManager.getCRNumber();
}

/**
 * Get VAT number from storage
 * @returns {string} VAT number
 */
function getVATNumber() {
  return StorageManager.getVATNumber();
}

function updateDocumentNumbers() {
  const crNumber = getCRNumber();
  const vatNumber = getVATNumber();
  
  const documentContainer = document.getElementById('toggle-document');
  if (documentContainer) {
    const paragraphs = documentContainer.querySelectorAll('p');
    if (paragraphs.length >= 2) {
      paragraphs[0].textContent = crNumber;  // First p tag for CR number
      paragraphs[1].textContent = vatNumber; // Second p tag for VAT number
    }
  }
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

// ============================================================================
// WEIGHT MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Get the effective weight for calculations (manual or live weight)
 * @returns {number} Effective weight in grams
 */
function getEffectiveWeight() {
  return manualWeight !== null ? manualWeight : currentWeight;
}

/**
 * Update the weight display to show manual or live weight with appropriate styling
 */
function updateWeightDisplay() {
  const weight = manualWeight !== null ? manualWeight : currentWeight;
  const modeIcon = document.getElementById('weight-mode-icon');
  
  if (manualWeight !== null) {
    // Manual weight mode - orange color and pen icon
    currentWeightElement.value = manualWeight.toFixed(2);
    currentWeightElement.style.color = '#d97706';
    if (modeIcon) modeIcon.textContent = '✍';
  } else {
    // Live weight mode - default color and scale icon
    currentWeightElement.value = currentWeight.toFixed(2);
    currentWeightElement.style.color = '';
    if (modeIcon) modeIcon.textContent = '⚖️';
  }
  
  // Update net gold weight display if stone deduction is active
  if (shouldShowStoneDeduction()) {
    netGoldWeightValue.textContent = getNetGoldWeight().toFixed(2);
  }
}

// ============================================================================
// UI UPDATE ORCHESTRATION
// ============================================================================

/**
 * Update all UI components in the correct order
 * This is the main function to call when any state changes
 */
function updateAllUI() {
  updateWeightDisplay();
  updateMainPriceDisplay();
  updateStoneDeductionUI();
  updateDetailsVisibility();
  updateModeUI();
  updateCostPerGramDisplay();
}

function updateCostPerGramDisplay() {
  const costPerGramElement = document.getElementById('cost-per-gram-bottom');
  if (!costPerGramElement) return;
  
  if (currentGoldPrice > 0) {
    // Calculate gold value per gram for the selected karat
    const price24K = (currentGoldPrice * 121.5) / 1000;
    const purityMultiplier = KARAT_MULTIPLIERS[selectedKarat];
    const goldValuePerGram = price24K * purityMultiplier;
    
    // Get manufacturing fee per gram for current settings
    const weightToUse = getNetGoldWeight();
    const manufacturingFeePerGram = getManufacturingFee(selectedKarat, selectedDesign, weightToUse);
    
    // Calculate total cost per gram
    let totalCostPerGram = 0;
    
    if (goldMode === 'sell') {
      // For sell mode: include manufacturing fee and tax
      const taxRate = selectedKarat === 24 ? 1 : 1.15;
      totalCostPerGram = (goldValuePerGram + manufacturingFeePerGram);
    } else {
      // For buy mode: subtract discount from gold value (no manufacturing fee in buy mode)
      const buyDiscount = getBuyDiscount();
      totalCostPerGram = goldValuePerGram - buyDiscount;
    }
    
    // Update the display
    const formattedPrice = totalCostPerGram.toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
    
    costPerGramElement.innerHTML = ` V: ${formattedPrice}`;
  } else {
    costPerGramElement.innerHTML = 'V: --';
  }
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
      updateStatus(connectionStatusElement, connected, message);
    }
  });
  initializePriceConnection();
  updateModeUI();
  renderDesignSelector(); 
  updateAllUI();
  updateDocumentNumbers();
  checkSubscription(document.querySelector('meta[name="device-mac"]').getAttribute("content"))
    .then(isSubscribed => {
      if (!isSubscribed) {
        updateStatus(subscribtionStatusElement, false, "الجهاز غير مشترك");
        document.getElementById("price-indicator").textContent = "انتهى الاشتراك.";
      } else {
        updateStatus(subscribtionStatusElement, true, "الجهاز مشترك");
      }
    })
    .catch(error => {
      console.error("Subscription check failed:", error);
      updateStatus(priceConnectionStatusElement, false, "فشل في التحقق من الاشتراك");
      document.getElementById("price-indicator").textContent = "فشل في التحقق من الاشتراك.";
    });

  if (currentWeightElement) {
    // Prevent any click events from bubbling up to parent toggle-details
    currentWeightElement.addEventListener('click', function(event) {
      event.stopPropagation();
    });
    
    // Handle weight changes when user finishes editing
    currentWeightElement.addEventListener('change', function(event) {
      event.stopPropagation();      
      const inputValue = parseFloat(event.target.value);
      if (!isNaN(inputValue) && inputValue >= 0) {
        manualWeight = inputValue;
        updateAllUI();
      } else if (event.target.value === '' || isNaN(inputValue)) {
        // Reset to current weight if invalid input
        manualWeight = null;
        updateAllUI();
      }
    });

  }

  const weightLabel = document.getElementById('weight-label');
  if (weightLabel) {
    weightLabel.onclick = function(event) {
      event.stopPropagation();
      if (manualWeight !== null) {
        manualWeight = null;
      } else {
        manualWeight = parseFloat(currentWeightElement.value) || 0;
      }
      updateAllUI();
    };
    }
      const modeToggle = document.getElementById('mode-toggle');
      modeToggle.addEventListener('click', function() {
        if (goldMode === 'sell') {
          window.setGoldMode('buy');
        } else {
          window.setGoldMode('sell');
        }
       
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
