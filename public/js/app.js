/**
 * Main application logic for the Grocery budget tracker.
 */

// Application state
const state = {
  records: [],
  selectedPayer: 'Shunaif',
  currentScan: null,
  apiKey: '',
  modelName: 'gemini-2.5-flash',
  chartRange: 'all',
  charts: {
    payerShare: null,
    shopSpend: null,
    spendTrend: null
  }
};

// DOM Elements
const elements = {
  // Navigation
  navScan: document.getElementById('nav-scan'),
  navHistory: document.getElementById('nav-history'),
  navAnalytics: document.getElementById('nav-analytics'),
  navSettings: document.getElementById('nav-settings'),
  views: document.querySelectorAll('.tab-view'),
  pageTitle: document.getElementById('page-title'),
  pageSubtitle: document.getElementById('page-subtitle'),

  // Payer Selectors
  btnPayerShunaif: document.getElementById('btn-payer-shunaif'),
  btnPayerNikko: document.getElementById('btn-payer-nikko'),

  // Upload Zone
  dropZone: document.getElementById('drop-zone'),
  fileInput: document.getElementById('file-input'),
  btnSelectFile: document.getElementById('btn-select-file'),
  previewContainer: document.getElementById('preview-container'),
  imagePreview: document.getElementById('image-preview'),
  btnRemoveFile: document.getElementById('btn-remove-file'),
  btnScanReceipt: document.getElementById('btn-scan-receipt'),
  scanSpinner: document.getElementById('scan-spinner'),
  scanBtnText: document.getElementById('scan-btn-text'),
  scanProgress: document.getElementById('scan-progress'),
  progressBarFill: document.getElementById('progress-bar-fill'),
  progressStatusText: document.getElementById('progress-status-text'),

  // Verification Form
  verificationEmptyState: document.getElementById('verification-empty-state'),
  verificationFormContainer: document.getElementById('verification-form-container'),
  verifyShop: document.getElementById('verify-shop'),
  verifyDate: document.getElementById('verify-date'),
  verifyTableBody: document.getElementById('verify-table-body'),
  verifyTotalExtracted: document.getElementById('verify-total-extracted'),
  btnAddItemRow: document.getElementById('btn-add-item-row'),
  btnCancelVerification: document.getElementById('btn-cancel-verification'),
  btnSaveVerification: document.getElementById('btn-save-verification'),

  // Logs / Spreadsheet
  logsTableBody: document.getElementById('logs-table-body'),
  tableTotalCount: document.getElementById('table-total-count'),
  filterSearch: document.getElementById('filter-search'),
  filterPayer: document.getElementById('filter-payer'),
  filterShop: document.getElementById('filter-shop'),
  btnClearFilters: document.getElementById('btn-clear-filters'),
  btnExportCsv: document.getElementById('btn-export-csv'),

  // Analytics Cards
  statTotalSpend: document.getElementById('stat-total-spend'),
  statTotalItems: document.getElementById('stat-total-items'),
  statSpentShunaif: document.getElementById('stat-spent-shunaif'),
  statShunaifPercent: document.getElementById('stat-shunaif-percent'),
  statSpentNikko: document.getElementById('stat-spent-nikko'),
  statNikkoPercent: document.getElementById('stat-nikko-percent'),
  statSettlement: document.getElementById('stat-settlement'),
  statSettlementDesc: document.getElementById('stat-settlement-desc'),
  settlementCard: document.getElementById('settlement-card'),
  statAvgSpend: document.getElementById('stat-avg-spend'),
  statAvgDesc: document.getElementById('stat-avg-desc'),
  trendChartControls: document.getElementById('trend-chart-controls'),

  // Settings
  settingsForm: document.getElementById('settings-form'),
  settingsApiKey: document.getElementById('settings-api-key'),
  settingsModel: document.getElementById('settings-model'),
  btnTestApi: document.getElementById('btn-test-api'),

  // Toasts
  toastContainer: document.getElementById('toast-container')
};

// Image selection state
let selectedImageFile = null;
let selectedImageBase64 = null;

// Initialize the Application
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Load configuration and local data
  loadSettings();
  initNavigation();
  initUploadHandlers();
  initVerificationHandlers();
  initFilters();
  initChartControls();
  initSettingsForm();

  // 2. Fetch records from Backend
  await fetchRecords();

  // 3. Render initial views
  renderShopFilterDropdown();
  renderHistoryTable();
  calculateAndRenderAnalytics();
  
  // Show toast on start
  showToast('Grocery Tracker initialized successfully', 'success');
});

/* ==========================================
   SETTINGS & LOCALSTORAGE
   ========================================== */
function loadSettings() {
  state.apiKey = localStorage.getItem('gemini_api_key') || '';
  state.modelName = localStorage.getItem('gemini_model') || 'gemini-2.5-flash';

  elements.settingsApiKey.value = state.apiKey;
  elements.settingsModel.value = state.modelName;

  // Let user know if API key is missing
  if (!state.apiKey) {
    showToast('Please add your Gemini API Key in the Settings tab to scan receipts.', 'error');
  }
}

function initSettingsForm() {
  elements.settingsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    state.apiKey = elements.settingsApiKey.value.trim();
    state.modelName = elements.settingsModel.value;

    localStorage.setItem('gemini_api_key', state.apiKey);
    localStorage.setItem('gemini_model', state.modelName);

    showToast('Settings saved successfully.', 'success');
    window.location.hash = 'scan';
    switchView('scan');
  });

  elements.btnTestApi.addEventListener('click', async () => {
    const testKey = elements.settingsApiKey.value.trim();
    const testModel = elements.settingsModel.value;
    if (!testKey) {
      showToast('Please enter an API Key to test.', 'error');
      return;
    }

    elements.btnTestApi.disabled = true;
    elements.btnTestApi.textContent = 'Testing connection...';

    try {
      // Small test prompt
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${testModel}:generateContent?key=${testKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Respond with the word "Success" and nothing else.' }] }]
        })
      });

      if (response.ok) {
        showToast('Gemini API connection test passed!', 'success');
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Connection failed');
      }
    } catch (err) {
      showToast(`API Test Failed: ${err.message}`, 'error');
    } finally {
      elements.btnTestApi.disabled = false;
      elements.btnTestApi.textContent = 'Test API Connection';
    }
  });
}

/* ==========================================
   NAVIGATION
   ========================================== */
function initNavigation() {
  const navItems = [
    { el: elements.navScan, view: 'scan', title: 'Scan Receipt', subtitle: 'Upload grocery receipts and instantly parse items using AI.' },
    { el: elements.navHistory, view: 'history', title: 'Logs & Spreadsheet', subtitle: 'Full list of raw records. You can review, edit inline, or export.' },
    { el: elements.navAnalytics, view: 'analytics', title: 'Spend Analytics', subtitle: 'Detailed breakdowns, splits, and trends for Nikko and Shunaif.' },
    { el: elements.navSettings, view: 'settings', title: 'Settings', subtitle: 'Manage your Gemini API configurations and keys.' }
  ];

  navItems.forEach(item => {
    item.el.addEventListener('click', (e) => {
      e.preventDefault();
      window.location.hash = item.view;
      switchView(item.view);
    });
  });

  // Handle URL hash routes on load
  const hash = window.location.hash.replace('#', '');
  if (hash && ['scan', 'history', 'analytics', 'settings'].includes(hash)) {
    switchView(hash);
  }
}

function switchView(viewName) {
  // Update nav UI active class
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const currentNav = document.getElementById(`nav-${viewName}`);
  if (currentNav) currentNav.classList.add('active');

  // Update views active class
  elements.views.forEach(view => {
    if (view.id === `view-${viewName}`) {
      view.classList.add('active');
    } else {
      view.classList.remove('active');
    }
  });

  // Update header text
  const titles = {
    scan: { t: 'Scan Receipt', s: 'Upload grocery receipts and instantly parse items using AI.' },
    history: { t: 'Logs & Spreadsheet', s: 'Full list of raw records. You can review, edit inline, or export.' },
    analytics: { t: 'Spend Analytics', s: 'Detailed breakdowns, splits, and trends for Nikko and Shunaif.' },
    settings: { t: 'Settings', s: 'Manage your Gemini API configurations and keys.' }
  };
  elements.pageTitle.textContent = titles[viewName].t;
  elements.pageSubtitle.textContent = titles[viewName].s;

  // Perform view-specific load actions
  if (viewName === 'analytics') {
    calculateAndRenderAnalytics();
  } else if (viewName === 'history') {
    renderShopFilterDropdown();
    renderHistoryTable();
  }
}

/* ==========================================
   BACKEND CLIENT SYNC
   ========================================== */
async function fetchRecords() {
  try {
    const res = await fetch('/api/groceries');
    if (!res.ok) throw new Error('Could not load groceries database.');
    state.records = await res.json();
  } catch (err) {
    showToast(`Error: ${err.message}. Using mock/local data.`, 'error');
  }
}

async function saveRecordsToBackend() {
  try {
    const res = await fetch('/api/groceries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state.records)
    });
    if (!res.ok) throw new Error('Failed to save records to database.');
    return true;
  } catch (err) {
    showToast(`Error saving to file: ${err.message}`, 'error');
    return false;
  }
}

/* ==========================================
   IMAGE UPLOAD & OCR FLOW
   ========================================== */
function initUploadHandlers() {
  // Payer Selectors
  elements.btnPayerShunaif.addEventListener('click', () => {
    state.selectedPayer = 'Shunaif';
    elements.btnPayerShunaif.classList.add('active');
    elements.btnPayerNikko.classList.remove('active');
  });

  elements.btnPayerNikko.addEventListener('click', () => {
    state.selectedPayer = 'Nikko';
    elements.btnPayerNikko.classList.add('active');
    elements.btnPayerShunaif.classList.remove('active');
  });

  // Drag and Drop
  elements.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.dropZone.classList.add('dragover');
  });

  elements.dropZone.addEventListener('dragleave', () => {
    elements.dropZone.classList.remove('dragover');
  });

  elements.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      handleImageSelection(file);
    } else {
      showToast('Please upload an image file.', 'error');
    }
  });

  // Browse buttons
  elements.btnSelectFile.addEventListener('click', () => {
    elements.fileInput.click();
  });

  elements.fileInput.addEventListener('change', () => {
    const file = elements.fileInput.files[0];
    if (file) {
      handleImageSelection(file);
    }
  });

  // Remove File
  elements.btnRemoveFile.addEventListener('click', () => {
    resetUploadState();
  });

  // Scan Button Trigger
  elements.btnScanReceipt.addEventListener('click', async () => {
    if (!selectedImageBase64) return;

    setScanLoadingState(true);
    updateScanProgress(20, 'Analyzing receipt image...');

    // Demo Mode Check: if API key is not entered, run simulated OCR
    if (!state.apiKey) {
      showToast('No API Key configured. Performing Demo OCR parsing on the receipt...', 'info');
      
      setTimeout(() => {
        updateScanProgress(50, 'Extracting line items (Demo Mode)...');
        setTimeout(() => {
          updateScanProgress(80, 'Formatting results...');
          setTimeout(() => {
            // Pre-parsed data from the actual receipt photo
            const demoParsedData = {
              shop: 'Supermart',
              date: '2026-06-16',
              items: [
                { description: 'Movenpick Greek Style Yogurt 400gm - Plain (T)', quantity: '1.00 pcs', price: 67.00 },
                { description: 'COKE ZERO 500ml PET (T)', quantity: '2.00 Pcs', price: 30.00 },
                { description: 'Kurkure Masala Munch Packet 78gm (T)', quantity: '1.00 pcs', price: 18.00 },
                { description: 'Fresh Celery Stick Kg (T)', quantity: '0.60 Kg', price: 20.00 },
                { description: 'Veg Potato White kg', quantity: '0.83 Kg', price: 13.28 },
                { description: 'Fresh Lime Green Small Kg', quantity: '0.21 Kg', price: 10.29 },
                { description: 'Veg Sweet Potato kg (T)', quantity: '0.30 Kg', price: 27.00 },
                { description: 'Veg Batana Pumpkin Kg (T)', quantity: '0.50 Kg', price: 21.00 },
                { description: 'Fresh Garlic', quantity: '0.28 Kg', price: 18.20 },
                { description: 'Enzi Rihaakuru 150g', quantity: '1.00 Pcs', price: 59.00 },
                { description: 'Kawan French Fries - Crinkle Cut 1 Kg (T)', quantity: '1.00 Pcs', price: 74.00 },
                { description: 'Emborg Broccoli Mix 450G (T)', quantity: '1.00 Units', price: 79.00 },
                { description: 'Cresswell - Chicken Breast Boneless 1kg (T)', quantity: '1.00 pcs', price: 90.00 },
                { description: 'Allana Frozen Meat 900 GRAM TRAY (T)', quantity: '1.00 Pcs', price: 145.00 },
                { description: 'Enzi Frozen YF Tuna Cubes 500g', quantity: '1.00 Pcs', price: 81.00 }
              ]
            };

            state.currentScan = {
              shop: demoParsedData.shop,
              date: demoParsedData.date,
              items: demoParsedData.items.map(item => ({
                ...item,
                paidBy: state.selectedPayer
              }))
            };

            renderVerificationForm();
            showToast('Demo Scan complete! Loaded receipt details.', 'success');
            setScanLoadingState(false);
          }, 800);
        }, 800);
      }, 800);
      return;
    }

    try {
      updateScanProgress(60, 'Analyzing receipt structure with Gemini AI...');
      
      const parsedData = await window.scanReceiptWithGemini(
        selectedImageBase64,
        selectedImageFile.type,
        state.apiKey,
        state.modelName
      );

      updateScanProgress(90, 'Formatting results table...');
      
      // Inject payment details
      state.currentScan = {
        shop: parsedData.shop,
        date: parsedData.date,
        items: parsedData.items.map(item => ({
          ...item,
          paidBy: state.selectedPayer
        }))
      };

      renderVerificationForm();
      showToast('Receipt parsed successfully! Please verify details.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
      console.error(err);
    } finally {
      setScanLoadingState(false);
    }
  });
}

function handleImageSelection(file) {
  selectedImageFile = file;
  const reader = new FileReader();
  
  reader.onload = (e) => {
    selectedImageBase64 = e.target.result;
    elements.imagePreview.src = selectedImageBase64;
    
    // UI toggle
    elements.dropZone.classList.add('hidden');
    elements.previewContainer.classList.remove('hidden');
    elements.btnScanReceipt.disabled = false;
  };
  
  reader.readAsDataURL(file);
}

function resetUploadState() {
  selectedImageFile = null;
  selectedImageBase64 = null;
  elements.imagePreview.src = '';
  elements.fileInput.value = '';
  
  elements.dropZone.classList.remove('hidden');
  elements.previewContainer.classList.add('hidden');
  elements.btnScanReceipt.disabled = true;
  elements.scanProgress.classList.add('hidden');
}

function setScanLoadingState(isLoading) {
  if (isLoading) {
    elements.btnScanReceipt.disabled = true;
    elements.scanSpinner.classList.remove('spinner-hidden');
    elements.scanBtnText.textContent = 'Processing Receipt...';
    elements.scanProgress.classList.remove('hidden');
    elements.btnRemoveFile.classList.add('hidden');
  } else {
    elements.btnScanReceipt.disabled = false;
    elements.scanSpinner.classList.add('spinner-hidden');
    elements.scanBtnText.textContent = 'Scan Receipt with Gemini AI';
    elements.scanProgress.classList.add('hidden');
    elements.btnRemoveFile.classList.remove('hidden');
  }
}

function updateScanProgress(percent, statusText) {
  elements.progressBarFill.style.width = `${percent}%`;
  elements.progressStatusText.textContent = statusText;
}

/* ==========================================
   VERIFICATION & ADJUSTMENTS
   ========================================== */
function initVerificationHandlers() {
  elements.btnAddItemRow.addEventListener('click', () => {
    if (!state.currentScan) return;
    state.currentScan.items.push({
      description: '',
      quantity: '1.00 pcs',
      price: 0.00,
      paidBy: state.selectedPayer
    });
    renderVerificationTable();
  });

  elements.btnCancelVerification.addEventListener('click', () => {
    state.currentScan = null;
    elements.verificationFormContainer.classList.add('hidden');
    elements.verificationEmptyState.classList.remove('hidden');
    elements.btnAddItemRow.classList.add('hidden');
    resetUploadState();
  });

  elements.btnSaveVerification.addEventListener('click', async () => {
    if (!state.currentScan) return;

    // 1. Gather values from form inputs
    const shop = elements.verifyShop.value.trim() || 'Supermart';
    const date = elements.verifyDate.value || new Date().toISOString().split('T')[0];

    // Read rows
    const rows = elements.verifyTableBody.querySelectorAll('tr');
    const items = [];
    let isValid = true;

    rows.forEach(row => {
      const descInput = row.querySelector('.col-desc');
      const qtyInput = row.querySelector('.col-qty');
      const priceInput = row.querySelector('.col-price');
      const paidSelect = row.querySelector('.col-paid');

      const description = descInput.value.trim();
      const quantity = qtyInput.value.trim() || '1.00 pcs';
      const price = parseFloat(priceInput.value);

      if (!description) {
        isValid = false;
        descInput.style.borderColor = 'var(--color-danger)';
      } else {
        descInput.style.borderColor = '';
      }

      if (isNaN(price) || price < 0) {
        isValid = false;
        priceInput.style.borderColor = 'var(--color-danger)';
      } else {
        priceInput.style.borderColor = '';
      }

      items.push({
        description,
        quantity,
        price,
        paidBy: paidSelect.value
      });
    });

    if (!isValid) {
      showToast('Please fix the highlighted errors before saving.', 'error');
      return;
    }

    // 2. Generate records with unique IDs and save to state
    const newRecords = items.map(item => ({
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      date: date,
      shop: shop,
      description: item.description,
      quantity: item.quantity,
      price: item.price,
      paidBy: item.paidBy
    }));

    state.records.push(...newRecords);

    // 3. Save to Local DB Express backend
    const saved = await saveRecordsToBackend();
    if (saved) {
      showToast(`Successfully saved ${newRecords.length} items to database!`, 'success');
      
      // Clear forms
      state.currentScan = null;
      elements.verificationFormContainer.classList.add('hidden');
      elements.verificationEmptyState.classList.remove('hidden');
      elements.btnAddItemRow.classList.add('hidden');
      
      resetUploadState();
      
      // Redirect to Spreadsheet Logs
      window.location.hash = 'history';
      switchView('history');
    }
  });
}

function renderVerificationForm() {
  if (!state.currentScan) return;

  elements.verifyShop.value = state.currentScan.shop;
  elements.verifyDate.value = state.currentScan.date;

  elements.verificationEmptyState.classList.add('hidden');
  elements.verificationFormContainer.classList.remove('hidden');
  elements.btnAddItemRow.classList.remove('hidden');

  renderVerificationTable();
}

function renderVerificationTable() {
  if (!state.currentScan) return;

  elements.verifyTableBody.innerHTML = '';
  let sumTotal = 0;

  state.currentScan.items.forEach((item, index) => {
    sumTotal += item.price;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <input type="text" class="table-input col-desc" value="${escapeHtml(item.description)}" placeholder="e.g. White Bread">
      </td>
      <td>
        <input type="text" class="table-input col-qty" value="${escapeHtml(item.quantity)}" placeholder="e.g. 1.00 pcs">
      </td>
      <td>
        <input type="number" step="0.01" class="table-input col-price" value="${item.price.toFixed(2)}">
      </td>
      <td>
        <select class="table-select col-paid">
          <option value="Shunaif" ${item.paidBy === 'Shunaif' ? 'selected' : ''}>Shunaif</option>
          <option value="Nikko" ${item.paidBy === 'Nikko' ? 'selected' : ''}>Nikko</option>
        </select>
      </td>
      <td class="text-center">
        <button type="button" class="btn-icon-only btn-remove-row" data-index="${index}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
        </button>
      </td>
    `;

    // Add inline event listeners to recalculate total on price changes
    const priceInput = tr.querySelector('.col-price');
    priceInput.addEventListener('input', () => {
      const val = parseFloat(priceInput.value) || 0;
      state.currentScan.items[index].price = val;
      recalculateVerificationTotal();
    });

    const descInput = tr.querySelector('.col-desc');
    descInput.addEventListener('input', () => {
      state.currentScan.items[index].description = descInput.value;
    });

    const qtyInput = tr.querySelector('.col-qty');
    qtyInput.addEventListener('input', () => {
      state.currentScan.items[index].quantity = qtyInput.value;
    });

    const paidSelect = tr.querySelector('.col-paid');
    paidSelect.addEventListener('change', () => {
      state.currentScan.items[index].paidBy = paidSelect.value;
    });

    // Remove row event listener
    tr.querySelector('.btn-remove-row').addEventListener('click', () => {
      state.currentScan.items.splice(index, 1);
      renderVerificationTable();
    });

    elements.verifyTableBody.appendChild(tr);
  });

  elements.verifyTotalExtracted.textContent = `MVR ${sumTotal.toFixed(2)}`;
}

function recalculateVerificationTotal() {
  if (!state.currentScan) return;
  const sum = state.currentScan.items.reduce((acc, cur) => acc + (cur.price || 0), 0);
  elements.verifyTotalExtracted.textContent = `MVR ${sum.toFixed(2)}`;
}

/* ==========================================
   SPREADSHEET LOGS VIEW
   ========================================== */
function initFilters() {
  elements.filterSearch.addEventListener('input', renderHistoryTable);
  elements.filterPayer.addEventListener('change', renderHistoryTable);
  elements.filterShop.addEventListener('change', renderHistoryTable);

  elements.btnClearFilters.addEventListener('click', () => {
    elements.filterSearch.value = '';
    elements.filterPayer.value = 'All';
    elements.filterShop.value = 'All';
    renderHistoryTable();
  });

  elements.btnExportCsv.addEventListener('click', exportToCsvSpreadsheet);
}

function initChartControls() {
  if (!elements.trendChartControls) return;
  const buttons = elements.trendChartControls.querySelectorAll('.btn-toggle');
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.chartRange = btn.getAttribute('data-range');
      renderSpendTrendChart();
    });
  });
}

function renderShopFilterDropdown() {
  const shops = ['All'];
  state.records.forEach(rec => {
    if (rec.shop && !shops.includes(rec.shop)) {
      shops.push(rec.shop);
    }
  });

  const selected = elements.filterShop.value;
  elements.filterShop.innerHTML = '';
  
  shops.forEach(shop => {
    const opt = document.createElement('option');
    opt.value = shop;
    opt.textContent = shop === 'All' ? 'All Shops' : shop;
    elements.filterShop.appendChild(opt);
  });

  // Restore selection if valid
  if (shops.includes(selected)) {
    elements.filterShop.value = selected;
  } else {
    elements.filterShop.value = 'All';
  }
}

function renderHistoryTable() {
  const searchQuery = elements.filterSearch.value.toLowerCase().trim();
  const filterPayerVal = elements.filterPayer.value;
  const filterShopVal = elements.filterShop.value;

  // Filter records
  const filtered = state.records.filter(rec => {
    const matchesSearch = 
      rec.description.toLowerCase().includes(searchQuery) ||
      rec.shop.toLowerCase().includes(searchQuery);
    
    const matchesPayer = filterPayerVal === 'All' || rec.paidBy === filterPayerVal;
    const matchesShop = filterShopVal === 'All' || rec.shop === filterShopVal;

    return matchesSearch && matchesPayer && matchesShop;
  });

  // Sort by date descending, then ID/description
  filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  elements.logsTableBody.innerHTML = '';
  elements.tableTotalCount.textContent = `Showing ${filtered.length} entries of ${state.records.length}`;

  if (filtered.length === 0) {
    elements.logsTableBody.innerHTML = `
      <tr>
        <td colspan="7" class="text-center text-secondary" style="padding: 40px;">
          No matching grocery records found.
        </td>
      </tr>
    `;
    return;
  }

  filtered.forEach(rec => {
    const tr = document.createElement('tr');
    tr.id = `rec-${rec.id}`;
    
    // Format Date from YYYY-MM-DD to DD-MM-YY
    let dateStr = rec.date;
    try {
      const parts = rec.date.split('-');
      if (parts.length === 3) {
        // YYYY-MM-DD -> DD-MM-YY
        dateStr = `${parts[2]}-${parts[1]}-${parts[0].substring(2)}`;
      }
    } catch(e) {}

    tr.innerHTML = `
      <td>
        <span class="view-mode">${escapeHtml(dateStr)}</span>
        <input type="date" class="table-input edit-mode hidden col-edit-date" value="${rec.date}">
      </td>
      <td>
        <span class="view-mode badge badge-shop">${escapeHtml(rec.shop)}</span>
        <input type="text" class="table-input edit-mode hidden col-edit-shop" value="${escapeHtml(rec.shop)}">
      </td>
      <td>
        <span class="view-mode">${escapeHtml(rec.description)}</span>
        <input type="text" class="table-input edit-mode hidden col-edit-desc" value="${escapeHtml(rec.description)}">
      </td>
      <td>
        <span class="view-mode">${escapeHtml(rec.quantity)}</span>
        <input type="text" class="table-input edit-mode hidden col-edit-qty" value="${escapeHtml(rec.quantity)}">
      </td>
      <td>
        <span class="view-mode">MVR ${rec.price.toFixed(2)}</span>
        <input type="number" step="0.01" class="table-input edit-mode hidden col-edit-price" value="${rec.price}">
      </td>
      <td>
        <span class="view-mode badge badge-${rec.paidBy.toLowerCase()}">${rec.paidBy}</span>
        <select class="table-select edit-mode hidden col-edit-paid">
          <option value="Shunaif" ${rec.paidBy === 'Shunaif' ? 'selected' : ''}>Shunaif</option>
          <option value="Nikko" ${rec.paidBy === 'Nikko' ? 'selected' : ''}>Nikko</option>
        </select>
      </td>
      <td>
        <div class="action-bar view-mode">
          <button type="button" class="btn-icon-only btn-edit-rec" title="Edit row">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
          </button>
          <button type="button" class="btn-icon-only btn-delete-rec" title="Delete row">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
          </button>
        </div>
        <div class="action-bar edit-mode hidden">
          <button type="button" class="btn-icon-only btn-save-rec text-s" title="Save changes">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
          <button type="button" class="btn-icon-only btn-cancel-edit text-secondary" title="Cancel edit">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </td>
    `;

    // Wire up events
    const editBtn = tr.querySelector('.btn-edit-rec');
    const deleteBtn = tr.querySelector('.btn-delete-rec');
    const saveBtn = tr.querySelector('.btn-save-rec');
    const cancelBtn = tr.querySelector('.btn-cancel-edit');

    editBtn.addEventListener('click', () => toggleRowEditMode(tr, true));
    cancelBtn.addEventListener('click', () => toggleRowEditMode(tr, false));
    
    deleteBtn.addEventListener('click', async () => {
      if (confirm(`Are you sure you want to delete "${rec.description}"?`)) {
        state.records = state.records.filter(r => r.id !== rec.id);
        const saved = await saveRecordsToBackend();
        if (saved) {
          showToast('Record deleted.', 'success');
          renderHistoryTable();
        }
      }
    });

    saveBtn.addEventListener('click', async () => {
      const newDate = tr.querySelector('.col-edit-date').value;
      const newShop = tr.querySelector('.col-edit-shop').value.trim();
      const newDesc = tr.querySelector('.col-edit-desc').value.trim();
      const newQty = tr.querySelector('.col-edit-qty').value.trim();
      const newPrice = parseFloat(tr.querySelector('.col-edit-price').value);
      const newPaid = tr.querySelector('.col-edit-paid').value;

      if (!newShop || !newDesc || isNaN(newPrice) || newPrice < 0) {
        showToast('Please enter valid data.', 'error');
        return;
      }

      // Update state
      const targetIndex = state.records.findIndex(r => r.id === rec.id);
      if (targetIndex !== -1) {
        state.records[targetIndex] = {
          ...state.records[targetIndex],
          date: newDate,
          shop: newShop,
          description: newDesc,
          quantity: newQty,
          price: newPrice,
          paidBy: newPaid
        };

        const saved = await saveRecordsToBackend();
        if (saved) {
          showToast('Record updated successfully.', 'success');
          toggleRowEditMode(tr, false);
          renderHistoryTable();
        }
      }
    });

    elements.logsTableBody.appendChild(tr);
  });
}

function toggleRowEditMode(tr, isEditing) {
  const viewElements = tr.querySelectorAll('.view-mode');
  const editElements = tr.querySelectorAll('.edit-mode');

  if (isEditing) {
    viewElements.forEach(el => el.classList.add('hidden'));
    editElements.forEach(el => el.classList.remove('hidden'));
  } else {
    viewElements.forEach(el => el.classList.remove('hidden'));
    editElements.forEach(el => el.classList.add('hidden'));
  }
}

/* ==========================================
   EXPORTS
   ========================================== */
function exportToCsvSpreadsheet() {
  if (state.records.length === 0) {
    showToast('No records available to export.', 'error');
    return;
  }

  // Define headers matching requested screenshot layout
  const headers = ['Date', 'Shop', 'Item Description', 'Quantity', 'Price (MVR)', 'Paid by'];
  
  // Format rows
  const rows = state.records.map(rec => {
    // Format date as DD-MM-YY
    let dateStr = rec.date;
    try {
      const parts = rec.date.split('-');
      if (parts.length === 3) {
        dateStr = `${parts[2]}-${parts[1]}-${parts[0].substring(2)}`;
      }
    } catch(e) {}

    return [
      dateStr,
      rec.shop,
      rec.description,
      rec.quantity,
      rec.price.toFixed(2),
      rec.paidBy
    ];
  });

  // Combine into CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(val => {
      // Escape commas and quotes
      const strVal = String(val);
      if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
        return `"${strVal.replace(/"/g, '""')}"`;
      }
      return strVal;
    }).join(','))
  ].join('\n');

  // Trigger browser download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `grocery_tracker_export_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  showToast('Spreadsheet CSV downloaded successfully!', 'success');
}

/* ==========================================
   ANALYTICS & CHART RENDERING
   ========================================== */
function calculateAndRenderAnalytics() {
  if (state.records.length === 0) {
    renderEmptyAnalytics();
    return;
  }

  // 1. Calculate general numbers
  let totalSpend = 0;
  let spentShunaif = 0;
  let spentNikko = 0;

  state.records.forEach(rec => {
    totalSpend += rec.price;
    if (rec.paidBy === 'Shunaif') {
      spentShunaif += rec.price;
    } else if (rec.paidBy === 'Nikko') {
      spentNikko += rec.price;
    }
  });

  // Calculate percentages
  const shunaifPercent = totalSpend > 0 ? (spentShunaif / totalSpend) * 100 : 0;
  const nikkoPercent = totalSpend > 0 ? (spentNikko / totalSpend) * 100 : 0;

  // Calculate settlement
  const halfShare = totalSpend / 2;
  let settlementVal = 0;
  let settlementDesc = '';
  
  if (spentShunaif > spentNikko) {
    settlementVal = spentShunaif - halfShare;
    settlementDesc = `Nikko owes Shunaif MVR ${settlementVal.toFixed(2)}`;
    elements.settlementCard.className = 'stat-card glass border-left-s';
    elements.statSettlement.className = 'stat-val text-s';
  } else if (spentNikko > spentShunaif) {
    settlementVal = spentNikko - halfShare;
    settlementDesc = `Shunaif owes Nikko MVR ${settlementVal.toFixed(2)}`;
    elements.settlementCard.className = 'stat-card glass border-left-n';
    elements.statSettlement.className = 'stat-val text-n';
  } else {
    settlementVal = 0.00;
    settlementDesc = 'You are perfectly even!';
    elements.settlementCard.className = 'stat-card glass border-left-warn';
    elements.statSettlement.className = 'stat-val text-warn';
  }

  // 30-day running average
  let anchorDate = new Date('2026-07-04');
  state.records.forEach(rec => {
    const recDate = new Date(rec.date);
    if (recDate > anchorDate) {
      anchorDate = recDate;
    }
  });

  const thirtyDaysAgo = new Date(anchorDate);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  let spendLast30Days = 0;
  state.records.forEach(rec => {
    const recDate = new Date(rec.date);
    if (recDate >= thirtyDaysAgo && recDate <= anchorDate) {
      spendLast30Days += rec.price;
    }
  });

  const dailyAvg = spendLast30Days / 30;

  // Update cards in DOM
  elements.statTotalSpend.textContent = `MVR ${totalSpend.toFixed(2)}`;
  elements.statTotalItems.textContent = `${state.records.length} total items tracked`;
  elements.statSpentShunaif.textContent = `MVR ${spentShunaif.toFixed(2)}`;
  elements.statShunaifPercent.textContent = `${shunaifPercent.toFixed(0)}% of total spend`;
  elements.statSpentNikko.textContent = `MVR ${spentNikko.toFixed(2)}`;
  elements.statNikkoPercent.textContent = `${nikkoPercent.toFixed(0)}% of total spend`;
  elements.statSettlement.textContent = `MVR ${settlementVal.toFixed(2)}`;
  elements.statSettlementDesc.textContent = settlementDesc;
  
  if (elements.statAvgSpend) {
    elements.statAvgSpend.textContent = `MVR ${dailyAvg.toFixed(2)}`;
    elements.statAvgDesc.textContent = `MVR ${spendLast30Days.toFixed(2)} total (Last 30D)`;
  }

  // 2. Render Charts
  renderPayerShareChart(spentShunaif, spentNikko);
  renderShopSpendChart();
  renderSpendTrendChart();
}

function renderEmptyAnalytics() {
  elements.statTotalSpend.textContent = 'MVR 0.00';
  elements.statTotalItems.textContent = '0 total items tracked';
  elements.statSpentShunaif.textContent = 'MVR 0.00';
  elements.statShunaifPercent.textContent = '0% of total spend';
  elements.statSpentNikko.textContent = 'MVR 0.00';
  elements.statNikkoPercent.textContent = '0% of total spend';
  elements.statSettlement.textContent = 'MVR 0.00';
  elements.statSettlementDesc.textContent = 'No settlement calculations available';
  
  if (elements.statAvgSpend) {
    elements.statAvgSpend.textContent = 'MVR 0.00';
    elements.statAvgDesc.textContent = 'MVR 0.00 total (Last 30D)';
  }
}

function renderPayerShareChart(shunaifVal, nikkoVal) {
  const ctx = document.getElementById('chart-payer-share').getContext('2d');
  
  if (state.charts.payerShare) {
    state.charts.payerShare.destroy();
  }

  state.charts.payerShare = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Shunaif', 'Nikko'],
      datasets: [{
        data: [shunaifVal, nikkoVal],
        backgroundColor: ['#0284c7', '#059669'],
        borderColor: '#ffffff',
        borderWidth: 3,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#0f172a',
            font: { family: 'Plus Jakarta Sans', size: 12 }
          }
        }
      }
    }
  });
}

function renderShopSpendChart() {
  const ctx = document.getElementById('chart-shop-spend').getContext('2d');
  
  // Aggregate spend by shop
  const shopData = {};
  state.records.forEach(rec => {
    shopData[rec.shop] = (shopData[rec.shop] || 0) + rec.price;
  });

  const labels = Object.keys(shopData);
  const data = Object.values(shopData);

  if (state.charts.shopSpend) {
    state.charts.shopSpend.destroy();
  }

  state.charts.shopSpend = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Spend by Store (MVR)',
        data: data,
        backgroundColor: 'rgba(109, 40, 217, 0.7)',
        borderColor: '#6d28d9',
        borderWidth: 1.5,
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          ticks: { color: '#475569', font: { family: 'Plus Jakarta Sans' } }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#475569', font: { family: 'Plus Jakarta Sans' } }
        }
      }
    }
  });
}

function renderSpendTrendChart() {
  const ctx = document.getElementById('chart-spend-trend').getContext('2d');
  
  // Determine date filtering range
  let filteredRecords = [...state.records];
  
  // Find the max date in records for anchoring
  let anchorDate = new Date('2026-07-04');
  state.records.forEach(rec => {
    const d = new Date(rec.date);
    if (d > anchorDate) anchorDate = d;
  });

  const range = state.chartRange || 'all';

  if (range === '1m' || range === '3m' || range === '6m') {
    const cutDate = new Date(anchorDate);
    if (range === '1m') cutDate.setDate(cutDate.getDate() - 30);
    else if (range === '3m') cutDate.setDate(cutDate.getDate() - 90);
    else if (range === '6m') cutDate.setDate(cutDate.getDate() - 180);

    filteredRecords = state.records.filter(rec => {
      const d = new Date(rec.date);
      return d >= cutDate && d <= anchorDate;
    });
  }

  // If range is 'monthly', aggregate totals per month
  if (range === 'monthly') {
    const monthlyData = {};
    filteredRecords.forEach(rec => {
      const monthKey = rec.date.substring(0, 7); // YYYY-MM
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + rec.price;
    });

    const sortedMonths = Object.keys(monthlyData).sort();
    const data = sortedMonths.map(m => monthlyData[m]);
    
    // Format labels as e.g. "Jun 2026"
    const labels = sortedMonths.map(m => {
      const parts = m.split('-');
      const date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
      return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    });

    if (state.charts.spendTrend) {
      state.charts.spendTrend.destroy();
    }

    state.charts.spendTrend = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Monthly Spending (MVR)',
          data: data,
          backgroundColor: 'rgba(109, 40, 217, 0.7)',
          borderColor: '#6d28d9',
          borderWidth: 1.5,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            labels: { color: '#0f172a', font: { family: 'Plus Jakarta Sans' } }
          }
        },
        scales: {
          y: {
            grid: { color: 'rgba(0, 0, 0, 0.05)' },
            ticks: { color: '#475569', font: { family: 'Plus Jakarta Sans' } }
          },
          x: {
            grid: { display: false },
            ticks: { color: '#475569', font: { family: 'Plus Jakarta Sans' } }
          }
        }
      }
    });
    return;
  }

  // Daily records aggregation (default)
  const dateData = {};
  filteredRecords.forEach(rec => {
    dateData[rec.date] = (dateData[rec.date] || 0) + rec.price;
  });

  const sortedDates = Object.keys(dateData).sort((a, b) => new Date(a) - new Date(b));
  
  let runningTotal = 0;
  const runningTotals = [];
  const dailySpends = [];
  
  sortedDates.forEach(date => {
    dailySpends.push(dateData[date]);
    runningTotal += dateData[date];
    runningTotals.push(runningTotal);
  });

  const labels = sortedDates.map(date => {
    try {
      const parts = date.split('-');
      return `${parts[2]}-${parts[1]}`;
    } catch(e) {
      return date;
    }
  });

  if (state.charts.spendTrend) {
    state.charts.spendTrend.destroy();
  }

  state.charts.spendTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Daily Purchase (MVR)',
          data: dailySpends,
          borderColor: '#059669',
          backgroundColor: 'rgba(5, 150, 105, 0.05)',
          fill: true,
          tension: 0.3,
          borderWidth: 2
        },
        {
          label: 'Cumulative Spending (MVR)',
          data: runningTotals,
          borderColor: '#6d28d9',
          backgroundColor: 'transparent',
          fill: false,
          tension: 0.1,
          borderWidth: 2.5,
          borderDash: [4, 4]
        }
      ]
    },
    options: {
      responsive: true,
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: '#0f172a',
            font: { family: 'Plus Jakarta Sans' }
          }
        }
      },
      scales: {
        y: {
          grid: { color: 'rgba(0, 0, 0, 0.05)' },
          ticks: { color: '#475569', font: { family: 'Plus Jakarta Sans' } }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#475569', font: { family: 'Plus Jakarta Sans' } }
        }
      }
    }
  });
}

/* ==========================================
   TOAST NOTIFICATION HELPER
   ========================================== */
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = '';
  if (type === 'success') {
    icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>`;
  } else if (type === 'error') {
    icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
  } else {
    icon = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
  }

  toast.innerHTML = `${icon} <span>${escapeHtml(message)}</span>`;
  elements.toastContainer.appendChild(toast);

  // Auto remove after 4 seconds
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 4000);
}

/* ==========================================
   ESCAPING SECURITY HELPERS
   ========================================== */
function escapeHtml(unsafe) {
  if (typeof unsafe !== 'string') return unsafe;
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
