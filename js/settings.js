/**
 * Settings Management for Gold Calculator
 * 
 * This module handles the settings page functionality including:
 * - Manufacturing fee settings per karat and design
 * - Buy discount and fluctuation range settings
 * - Company information (CR and VAT numbers)
 * - Fixed manufacturing fee for small weights
 */

import { DEFAULT_MANUFACTURING_SETTINGS } from './manufacturingDefaults.js';
import { StorageManager } from './storageUtils.js';

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

// Current manufacturing settings loaded from storage
let manufacturingSettings = StorageManager.getManufacturingSettings({...DEFAULT_MANUFACTURING_SETTINGS});

// Track selected design tab per karat for UI state
const selectedDesignTab = { 18: null, 21: null, 24: null };

// ============================================================================
// STORAGE OPERATIONS
// ============================================================================

/**
 * Load manufacturing settings from storage
 * @returns {Object} Manufacturing settings object
 */
function loadManufacturingSettings() {
  return StorageManager.getManufacturingSettings({...DEFAULT_MANUFACTURING_SETTINGS});
}

/**
 * Save current manufacturing settings to storage
 */
function saveManufacturingSettings() {
  StorageManager.setManufacturingSettings(manufacturingSettings);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Get all unique design types for a specific karat
 * @param {number} karat - The karat level (18, 21, 24)
 * @returns {Array<string>} Array of design names
 */
function getAllDesignsForKarat(karat) {
  const ranges = manufacturingSettings[karat.toString()] || [];
  const set = new Set(ranges.map(r => r.design));
  if (set.size === 0) {
    ['محلي', 'ايطالي', 'هندي', 'غوايش', 'سويسري'].forEach(d => set.add(d));
  }
  return Array.from(set);
}

// ============================================================================
// UI RENDERING FUNCTIONS
// ============================================================================

/**
 * Initialize and render the complete settings page
 */
function renderSettings() {
  // Render manufacturing settings for each karat
  renderKaratSettings(18);
  renderKaratSettings(21);
  renderKaratSettings(24);
  
  // Load and display current values
  loadCurrentValues();
  
  // Setup event listeners
  setupEventListeners();
}

/**
 * Load current values from storage and populate form fields
 */
function loadCurrentValues() {
  document.getElementById('buy-discount').value = StorageManager.getBuyDiscount();
  document.getElementById('fluctuation-range').value = StorageManager.getFluctuationRange();
  document.getElementById('fixed-manufacturing-fee').value = StorageManager.getFixedManufacturingFee();
  document.getElementById('cr-number').value = StorageManager.getCRNumber();
  document.getElementById('vat-number').value = StorageManager.getVATNumber();
}

/**
 * Setup all event listeners for the settings page
 */
function setupEventListeners() {
  document.getElementById('save-btn').addEventListener('click', saveSettings);
  document.getElementById('add-range-18').addEventListener('click', () => addRange(18));
  document.getElementById('add-range-21').addEventListener('click', () => addRange(21));
  document.getElementById('add-range-24').addEventListener('click', () => addRange(24));
}

/**
 * Render settings for a specific karat level
 * @param {number} karat - The karat level to render
 */
function renderKaratSettings(karat) {
  renderDesignTabs(karat);
  renderRangesForSelectedDesign(karat);
}

/**
 * Render design tabs for a specific karat level
 * @param {number} karat - The karat level
 */
function renderDesignTabs(karat) {
  const container = document.getElementById(`design-tabs-${karat}`);
  if (!container) return;
  
  const designs = getAllDesignsForKarat(karat);
  
  // Ensure a design is selected
  if (!selectedDesignTab[karat] || !designs.includes(selectedDesignTab[karat])) {
    selectedDesignTab[karat] = designs[0];
  }
  
  // Clear and rebuild tabs
  container.innerHTML = '';
  
  designs.forEach((design, idx) => {
    const tab = createDesignTab(design, karat, selectedDesignTab[karat] === design);
    container.appendChild(tab);
  });
  
  // Add "Add Design" button
  const addBtn = createAddDesignButton(karat);
  container.appendChild(addBtn);
}

/**
 * Create a design tab element
 * @param {string} design - Design name
 * @param {number} karat - Karat level
 * @param {boolean} isActive - Whether this tab is active
 * @returns {HTMLElement} The tab element
 */
function createDesignTab(design, karat, isActive) {
  const tab = document.createElement('div');
  tab.className = 'design-tab' + (isActive ? ' active' : '');
  tab.textContent = design;
  tab.onclick = () => {
    selectedDesignTab[karat] = design;
    renderDesignTabs(karat);
    renderRangesForSelectedDesign(karat);
  };
  return tab;
}

/**
 * Create an "Add Design" button
 * @param {number} karat - Karat level
 * @returns {HTMLElement} The add button element
 */
function createAddDesignButton(karat) {
  const addBtn = document.createElement('div');
  addBtn.className = 'design-tab add-design';
  addBtn.textContent = '+';
  addBtn.onclick = () => addDesign(karat);
  return addBtn;
}

/**
 * Render weight ranges for the currently selected design
 * @param {number} karat - The karat level
 */
function renderRangesForSelectedDesign(karat) {
  const container = document.getElementById(`ranges-${karat}`);
  if (!container) return;
  
  const design = selectedDesignTab[karat];
  if (!design) return;
  
  const ranges = manufacturingSettings[karat.toString()] || [];
  const designRanges = ranges.filter(r => r.design === design);
  
  // Clear container
  container.innerHTML = '';
  
  // Render each range row
  designRanges.forEach((range, idx) => {
    const row = createRangeRow(range, karat, design, idx);
    container.appendChild(row);
  });
  
  // Add remove design button if multiple designs exist
  addRemoveDesignButton(container, karat, design);
}

/**
 * Create a range input row
 * @param {Object} range - Range object with from, to, fee properties
 * @param {number} karat - Karat level
 * @param {string} design - Design name
 * @param {number} idx - Range index
 * @returns {HTMLElement} The range row element
 */
function createRangeRow(range, karat, design, idx) {
  const row = document.createElement('div');
  row.className = 'range-row';
  row.innerHTML = `
    <input type="number" step="0.01" value="${range.from}" 
           onchange="updateRangeByDesign(${karat}, '${design}', ${idx}, 'from', this.value)">
    <span>إلى</span>
    <input type="number" step="0.01" value="${range.to}" 
           onchange="updateRangeByDesign(${karat}, '${design}', ${idx}, 'to', this.value)">
    <span>رسوم:</span>
    <input type="number" step="1" value="${range.fee}" 
           onchange="updateRangeByDesign(${karat}, '${design}', ${idx}, 'fee', this.value)">
    <button onclick="removeRangeByDesign(${karat}, '${design}', ${idx})" class="remove-btn">حذف</button>
  `;
  return row;
}

/**
 * Add remove design button if multiple designs exist
 * @param {HTMLElement} container - Container element
 * @param {number} karat - Karat level
 * @param {string} design - Design name
 */
function addRemoveDesignButton(container, karat, design) {
  const allDesigns = getAllDesignsForKarat(karat);
  if (allDesigns.length > 1) {
    const removeDesignBtn = document.createElement('button');
    removeDesignBtn.textContent = `حذف تصميم "${design}"`;
    removeDesignBtn.className = 'remove-design-btn';
    removeDesignBtn.onclick = () => removeDesign(karat, design);
    container.appendChild(removeDesignBtn);
  }
}

// ============================================================================
// DESIGN MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Add a new design type for a specific karat
 * @param {number} karat - The karat level
 */
function addDesign(karat) {
  const newDesign = prompt('اسم التصميم الجديد:');
  if (newDesign && newDesign.trim()) {
    const trimmed = newDesign.trim();
    
    // Check if design already exists
    const existingDesigns = getAllDesignsForKarat(karat);
    if (existingDesigns.includes(trimmed)) {
      alert('هذا التصميم موجود بالفعل!');
      return;
    }
    
    // Add new design with default range
    manufacturingSettings[karat.toString()].push({
      design: trimmed, 
      from: 1, 
      to: 2, 
      fee: 100
    });
    
    selectedDesignTab[karat] = trimmed;
    renderKaratSettings(karat);
  }
}

/**
 * Remove a design type and all its ranges
 * @param {number} karat - The karat level
 * @param {string} design - The design name to remove
 */
function removeDesign(karat, design) {
  if (confirm(`هل أنت متأكد من حذف تصميم "${design}"؟`)) {
    manufacturingSettings[karat.toString()] = manufacturingSettings[karat.toString()]
      .filter(r => r.design !== design);
    selectedDesignTab[karat] = null;
    renderKaratSettings(karat);
  }
}

// ============================================================================
// RANGE MANAGEMENT FUNCTIONS
// ============================================================================

/**
 * Add a new weight range for the selected design
 * @param {number} karat - The karat level
 */
function addRange(karat) {
  const design = selectedDesignTab[karat];
  if (!design) {
    alert('يرجى اختيار تصميم أولاً');
    return;
  }
  
  // Add new range with default values
  manufacturingSettings[karat.toString()].push({
    design, 
    from: 1, 
    to: 2, 
    fee: 100
  });
  
  renderRangesForSelectedDesign(karat);
}

/**
 * Update a specific field in a weight range
 * @param {number} karat - The karat level
 * @param {string} design - The design name
 * @param {number} index - The range index within the design
 * @param {string} field - The field to update ('from', 'to', 'fee')
 * @param {string} value - The new value
 */
function updateRangeByDesign(karat, design, index, field, value) {
  const ranges = manufacturingSettings[karat.toString()] || [];
  const designRanges = ranges.filter(r => r.design === design);
  
  if (designRanges[index]) {
    const originalIndex = ranges.indexOf(designRanges[index]);
    
    if (field === 'from' || field === 'to') {
      ranges[originalIndex][field] = parseFloat(value) || 0;
    } else if (field === 'fee') {
      ranges[originalIndex][field] = parseInt(value) || 0;
    }
  }
}

/**
 * Remove a specific weight range
 * @param {number} karat - The karat level
 * @param {string} design - The design name
 * @param {number} index - The range index within the design
 */
function removeRangeByDesign(karat, design, index) {
  const ranges = manufacturingSettings[karat.toString()] || [];
  const designRanges = ranges.filter(r => r.design === design);
  
  if (designRanges[index]) {
    const originalIndex = ranges.indexOf(designRanges[index]);
    manufacturingSettings[karat.toString()].splice(originalIndex, 1);
    renderRangesForSelectedDesign(karat);
  }
}

// ============================================================================
// SAVE FUNCTIONALITY
// ============================================================================

/**
 * Save all settings to localStorage
 */
function saveSettings() {
  try {
    // Save manufacturing settings
    saveManufacturingSettings();
    
    // Save other settings using StorageManager
    StorageManager.setBuyDiscount(document.getElementById('buy-discount').value);
    StorageManager.setFluctuationRange(document.getElementById('fluctuation-range').value);
    StorageManager.setFixedManufacturingFee(document.getElementById('fixed-manufacturing-fee').value);
    StorageManager.setCRNumber(document.getElementById('cr-number').value);
    StorageManager.setVATNumber(document.getElementById('vat-number').value);
    
    alert('تم حفظ الإعدادات بنجاح!');
  } catch (error) {
    console.error('Error saving settings:', error);
    alert('حدث خطأ أثناء حفظ الإعدادات!');
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the settings page when the window loads
 */
window.onload = renderSettings;
// Make functions globally available for HTML onclick handlers
window.updateRangeByDesign = updateRangeByDesign;
window.removeRangeByDesign = removeRangeByDesign;
