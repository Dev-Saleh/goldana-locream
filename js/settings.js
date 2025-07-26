import {DEFAULT_MANUFACTURING_SETTINGS} from './manufacturingDefaults.js';
const DEFAULT_BUY_DISCOUNT = 20;
const DEFAULT_FLUCTUATION_RANGE = 1;

function loadManufacturingSettings() {
  const saved = localStorage.getItem('goldManufacturingSettings');
  return saved ? JSON.parse(saved) : {...DEFAULT_MANUFACTURING_SETTINGS};
}

function saveManufacturingSettings() {
  localStorage.setItem('goldManufacturingSettings', JSON.stringify(manufacturingSettings));
}

function loadBuyDiscount() {
  const saved = localStorage.getItem('buyDiscount');
  return saved !== null ? parseFloat(saved) : DEFAULT_BUY_DISCOUNT;
}

function saveBuyDiscount(value) {
  localStorage.setItem('buyDiscount', value);
}

function loadFluctuationRange() {
  const saved = localStorage.getItem('fluctuationRange');
  return saved !== null ? parseFloat(saved) : DEFAULT_FLUCTUATION_RANGE;
}

function saveFluctuationRange(value) {
  localStorage.setItem('fluctuationRange', value);
}

let manufacturingSettings = loadManufacturingSettings();

// Track selected design tab per karat
const selectedDesignTab = { 18: null, 21: null, 24: null };

function renderSettings() {
  renderKaratSettings(18);
  renderKaratSettings(21);
  renderKaratSettings(24);
  document.getElementById('buy-discount').value = loadBuyDiscount();
  document.getElementById('fluctuation-range').value = loadFluctuationRange();
}
    
    function renderKaratSettings(karat) {
      renderDesignTabs(karat);
      renderRangesForSelectedDesign(karat);
    }
    
    function renderDesignTabs(karat) {
      const container = document.getElementById(`design-tabs-${karat}`);
      if (!container) return;
      const designs = getAllDesignsForKarat(karat);
      // If no design selected, pick first
      if (!selectedDesignTab[karat] || !designs.includes(selectedDesignTab[karat])) {
        selectedDesignTab[karat] = designs[0];
      }
      container.innerHTML = '';
      designs.forEach((design, idx) => {
        const tab = document.createElement('div');
        tab.className = 'design-tab' + (selectedDesignTab[karat] === design ? ' active' : '');
        tab.textContent = design;
        tab.onclick = () => {
          selectedDesignTab[karat] = design;
          renderKaratSettings(karat);
        };
        // Remove button (only if more than 1 design)
        if (designs.length > 1) {
          const removeBtn = document.createElement('button');
          removeBtn.className = 'remove-design-btn';
          removeBtn.title = 'حذف التصميم';
          removeBtn.innerHTML = '×';
          removeBtn.onclick = (e) => {
            e.stopPropagation();
            removeDesign(karat, design);
          };
          tab.appendChild(removeBtn);
        }
        container.appendChild(tab);
      });
      // Add-design tab
      const addTab = document.createElement('div');
      addTab.className = 'add-design-tab';
      addTab.innerHTML = '<span>➕</span> <span>إضافة تصميم</span>';
      addTab.onclick = () => addDesign(karat);
      container.appendChild(addTab);
    }
    
    function renderRangesForSelectedDesign(karat) {
      const container = document.getElementById(`ranges-${karat}`);
      container.innerHTML = '';
      const design = selectedDesignTab[karat];
      const ranges = (manufacturingSettings[karat] || []).filter(r => r.design === design);
      ranges.forEach((range, index) => {
        const rangeDiv = document.createElement('div');
        rangeDiv.className = 'range-row';
        rangeDiv.innerHTML = `
        <span>من</span>
          <input type="number" value="${range.from}" step="0.1" onchange="updateRangeByDesign(${karat}, '${design}', ${index}, 'from', this.value)">
          <span>إلى</span>
          <input type="number" value="${range.to}" step="0.1" onchange="updateRangeByDesign(${karat}, '${design}', ${index}, 'to', this.value)">
          <input type="number" value="${range.fee}" onchange="updateRangeByDesign(${karat}, '${design}', ${index}, 'fee', this.value)">
          <button onclick="removeRangeByDesign(${karat}, '${design}', ${index})">حذف</button>
        `;
        container.appendChild(rangeDiv);
      });
    }
    
    function getAllDesignsForKarat(karat) {
      const ranges = manufacturingSettings[karat] || [];
      const set = new Set(ranges.map(r => r.design));
      if (set.size === 0) {
        ['محلي', 'ايطالي', 'هندي', 'غوايش', 'سويسري'].forEach(d => set.add(d));
      }
      return Array.from(set);
    }

    function addDesign(karat) {
      const name = prompt('أدخل اسم التصميم الجديد:');
      if (!name) return;
      // Add a dummy range for the new design
      manufacturingSettings[karat].push({ design: name, from: 0, to: 1, fee: 0 });
      selectedDesignTab[karat] = name;
      renderKaratSettings(karat);
    }

    function removeDesign(karat, design) {
      // Remove all ranges for this design
      manufacturingSettings[karat] = (manufacturingSettings[karat] || []).filter(r => r.design !== design);
      // Pick another design
      const designs = getAllDesignsForKarat(karat);
      selectedDesignTab[karat] = designs[0];
      renderKaratSettings(karat);
    }

    function addRange(karat) {
      const design = selectedDesignTab[karat];
      const ranges = (manufacturingSettings[karat] || []).filter(r => r.design === design);
      const last = ranges[ranges.length - 1];
      manufacturingSettings[karat].push({
        design,
        from: last ? last.to : 0,
        to: last ? last.to + 1 : 1,
        fee: last ? last.fee : 0
      });
      renderKaratSettings(karat);
    }
    
    function updateRangeByDesign(karat, design, index, field, value) {
      const all = manufacturingSettings[karat] || [];
      let count = -1;
      for (let i = 0; i < all.length; ++i) {
        if (all[i].design === design) {
          count++;
          if (count === index) {
            if (field === 'from' || field === 'to' || field === 'fee') {
              all[i][field] = parseFloat(value) || 0;
            }
            break;
          }
        }
      }
    }
    
    function removeRangeByDesign(karat, design, index) {
      const all = manufacturingSettings[karat] || [];
      let count = -1;
      for (let i = 0; i < all.length; ++i) {
        if (all[i].design === design) {
          count++;
          if (count === index) {
            all.splice(i, 1);
            break;
          }
        }
      }
      renderKaratSettings(karat);
    }
    
    function saveSettings() {
      saveManufacturingSettings();
      const buyDiscount = parseFloat(document.getElementById('buy-discount').value) || DEFAULT_BUY_DISCOUNT;
      saveBuyDiscount(buyDiscount);
      const fluctuationRange = parseFloat(document.getElementById('fluctuation-range').value) || DEFAULT_FLUCTUATION_RANGE;
      saveFluctuationRange(fluctuationRange);
      alert('تم حفظ الإعدادات بنجاح!');
    }
    
    // تهيئة الصفحة عند التحميل
    window.onload = renderSettings;
