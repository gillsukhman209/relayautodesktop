console.log("📦 content.js loaded");
console.log("✅ content.js is running");

let isDetectionActive = false;
let detectionTimeout;
let baseDelay = 800;
let randomDelay = 500;
let globallySeenNewLoads = new Set(); // To prevent re-detecting the same new loads

const SETTINGS_KEY = "amazonRelayLoadDetectorSettings";
let currentSettings = {};

const defaultSettings = {
  baseDelay: 800,
  randomDelay: 500,
  minPriceIncrease: 5,
  autobooker: false,
  fastBook: false,
  showProfitCalculator: true,
  truckMPG: 6.5,
  fuelPrice: 4.5,
  blacklist: [], // Default to an empty list
};

function saveSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error("Failed to save settings:", e);
  }
}

function loadSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    // Merge saved settings with defaults to ensure all keys are present
    return saved
      ? { ...defaultSettings, ...JSON.parse(saved) }
      : defaultSettings;
  } catch (e) {
    console.error("Failed to load settings, using defaults:", e);
    return defaultSettings;
  }
}

function clickRefreshButton() {
  console.log("🔁 Clicking refresh button");
  const refreshBtn = document.querySelector("button.css-q7ppch");
  if (refreshBtn) {
    console.log("🔁 Clicking refresh button");
    refreshBtn.click();
  } else {
    console.warn("⚠️ Refresh button not found.");
  }
}

function injectModernStyles() {
  // This function is deprecated and its contents are now managed in setupUI.
  // It is kept here to prevent errors if old versions of the script call it,
  // but it should be empty.
}

function setupUI() {
  const controlPanelHTML = `
    <div id="amazon-relay-detector-panel">
      <div class="arl-header">
        <span class="arl-title">Load Detector</span>
        <div class="arl-header-controls">
          <div id="arl-status-container">
            <div id="arl-status-indicator"></div>
            <span id="arl-status-text">Stopped</span>
          </div>
          <button id="arl-settings-btn" class="arl-btn-icon">⚙️</button>
        </div>
      </div>
      
      <div class="arl-slider-group">
        <label for="arl-base-speed">Base Speed: <span id="arl-base-speed-value" class="arl-slider-value">800ms</span></label>
        <input type="range" id="arl-base-speed" min="200" max="10000" step="100" value="800">
      </div>
      
      <div class="arl-slider-group">
        <label for="arl-randomizer">Randomizer: <span id="arl-randomizer-value" class="arl-slider-value">500ms</span></label>
        <input type="range" id="arl-randomizer" min="0" max="5000" step="50" value="500">
      </div>
      
      <div class="arl-button-group">
        <button id="arl-start-btn" class="arl-btn arl-btn-start">Start</button>
        <button id="arl-stop-btn" class="arl-btn arl-btn-stop">Stop</button>
      </div>

      <div id="arl-settings-panel" style="display: none;">
        <h4 class="arl-settings-title">Settings</h4>
        <div class="arl-setting">
          <label for="arl-autobooker-toggle">Autobooker</label>
          <label class="arl-toggle-switch">
            <input type="checkbox" id="arl-autobooker-toggle">
            <span class="arl-toggle-slider"></span>
          </label>
        </div>
        <div class="arl-setting">
          <label for="arl-min-price-increase">Min Price Increase ($)</label>
          <input type="number" id="arl-min-price-increase" class="arl-number-input" placeholder="e.g., 50" value="5">
        </div>
        <div class="arl-setting">
          <label for="arl-fastbook-toggle">Fast Book</label>
          <label class="arl-toggle-switch">
            <input type="checkbox" id="arl-fastbook-toggle">
            <span class="arl-toggle-slider"></span>
          </label>
        </div>
        <h4 class="arl-settings-title" style="margin-top: 20px; border-top: 1px solid var(--arl-border); padding-top: 15px;">Profit Calculator</h4>
        <div class="arl-setting">
          <label for="arl-profit-toggle">Enable Profit Calculator</label>
          <label class="arl-toggle-switch">
            <input type="checkbox" id="arl-profit-toggle">
            <span class="arl-toggle-slider"></span>
          </label>
        </div>
        <div class="arl-setting">
          <label for="arl-mpg-input">Truck's Avg. MPG</label>
          <input type="number" id="arl-mpg-input" class="arl-number-input" step="0.1">
        </div>
        <div class="arl-setting">
          <label for="arl-fuel-price-input">Fuel Price ($/gal)</label>
          <input type="number" id="arl-fuel-price-input" class="arl-number-input" step="0.01">
        </div>
        <h4 class="arl-settings-title" style="margin-top: 20px; border-top: 1px solid var(--arl-border); padding-top: 15px;">Blacklist</h4>
        <div class="arl-setting-full-width">
           <label for="arl-blacklist-input">Keywords (comma-separated city/code)</label>
          <textarea id="arl-blacklist-input" class="arl-textarea-input" placeholder="e.g., SCK1, Fremont, DFO3"></textarea>
        </div>
      </div>
    </div>
  `;

  const styles = `
    :root {
      --arl-primary: #4e80ee;
      --arl-success: #2ea043;
      --arl-danger: #da3633;
      --arl-bg: #1c1c1e;
      --arl-bg-light: #2c2c2e;
      --arl-border: #363638;
      --arl-text: #e1e1e3;
      --arl-text-muted: #8b8b90;
    }
    #amazon-relay-detector-panel {
      position: relative;
      margin-top: 12px;
      z-index: 999999;
      background-color: var(--arl-bg);
      color: var(--arl-text);
      border: 1px solid var(--arl-border);
      border-radius: 12px;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      min-width: 240px;
      max-width: 350px;
      width: 100%;
      box-sizing: border-box;
      flex-shrink: 0;
      overflow: visible;
    }
    
    /* Responsive adjustments for smaller screens */
    @media (max-width: 500px) {
      #amazon-relay-detector-panel {
        min-width: 200px;
        max-width: 300px;
        padding: 12px;
      }
    }
    
    @media (max-width: 400px) {
      #amazon-relay-detector-panel {
        min-width: 180px;
        max-width: 250px;
        padding: 10px;
      }
    }
    .arl-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .arl-title { font-size: 16px; font-weight: 600; }
    .arl-header-controls { display: flex; align-items: center; gap: 10px; }
    #arl-status-container { display: flex; align-items: center; background-color: var(--arl-bg-light); padding: 4px 8px; border-radius: 6px; }
    #arl-status-indicator { width: 10px; height: 10px; border-radius: 50%; margin-right: 8px; background-color: var(--arl-danger); transition: background-color 0.3s ease; }
    #arl-status-text { font-size: 12px; font-weight: 500; color: var(--arl-text-muted); }
    
    .arl-slider-group { margin-bottom: 12px; }
    .arl-slider-group label { font-size: 14px; color: var(--arl-text-muted); }
    .arl-slider-value { color: var(--arl-text); font-weight: 500; }
    
    input[type="range"]#arl-base-speed, input[type="range"]#arl-randomizer {
      -webkit-appearance: none !important;
      appearance: none !important;
      width: 100% !important;
      height: 6px !important;
      background: var(--arl-bg-light) !important;
      border-radius: 3px !important;
      outline: none !important;
      margin-top: 8px !important;
    }
    input[type="range"]#arl-base-speed::-webkit-slider-thumb, input[type="range"]#arl-randomizer::-webkit-slider-thumb {
      -webkit-appearance: none !important;
      appearance: none !important;
      width: 16px !important;
      height: 16px !important;
      background: var(--arl-primary) !important;
      cursor: pointer !important;
      border-radius: 50% !important;
    }
    
    .arl-button-group { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 16px; }
    .arl-btn { border: none; padding: 10px; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
    .arl-btn-start { background-color: var(--arl-success); color: white; }
    .arl-btn-stop { background-color: var(--arl-danger); color: white; }
    .arl-btn:hover { opacity: 0.85; }

    .arl-btn:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .arl-btn-icon {
      background: var(--arl-bg-light);
      border: none;
      color: var(--arl-text-muted);
      width: 30px;
      height: 30px;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      transition: background-color 0.2s;
    }
    .arl-btn-icon:hover {
      background: var(--arl-border);
    }
    
    /* --- Settings Panel --- */
    #arl-settings-panel {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 1px solid var(--arl-border);
      animation: arl-fade-in 0.5s ease;
    }

    @keyframes arl-fade-in {
      from { opacity: 0; transform: translateY(-10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    
    .arl-settings-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--arl-text-muted);
      margin-bottom: 15px;
    }

    .arl-setting {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .arl-setting label {
      font-size: 14px;
      color: var(--arl-text);
    }

    /* Custom Toggle Switch */
    .arl-toggle-switch {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
    }
    .arl-toggle-switch input { opacity: 0; width: 0; height: 0; }
    .arl-toggle-slider {
      position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0;
      background-color: var(--arl-bg-light);
      border-radius: 24px;
      transition: .3s;
    }
    .arl-toggle-slider:before {
      position: absolute; content: ""; height: 18px; width: 18px;
      left: 3px; bottom: 3px;
      background-color: white;
      border-radius: 50%;
      transition: .3s;
    }
    input:checked + .arl-toggle-slider { background-color: var(--arl-success); }
    input:checked + .arl-toggle-slider:before { transform: translateX(20px); }
    
    /* Custom Number Input */
    .arl-number-input {
      background: var(--arl-bg-light);
      border: 1px solid var(--arl-border);
      color: var(--arl-text);
      border-radius: 6px;
      padding: 4px 8px;
      width: 80px;
      text-align: right;
      font-size: 14px;
    }
    .arl-number-input:focus {
      outline: none;
      border-color: var(--arl-primary);
    }

    .arl-setting-full-width {
      display: flex;
      flex-direction: column;
      margin-bottom: 12px;
    }
    .arl-setting-full-width label {
      font-size: 14px;
      color: var(--arl-text);
      margin-bottom: 8px;
    }
    .arl-textarea-input {
      background: var(--arl-bg-light);
      border: 1px solid var(--arl-border);
      color: var(--arl-text);
      border-radius: 6px;
      padding: 8px;
      width: 100%;
      min-height: 60px;
      box-sizing: border-box;
      font-family: inherit;
      font-size: 14px;
      resize: vertical;
    }

    /* --- Profit Badge --- */
    .arl-profit-badge {
      font-size: 13px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 6px;
      margin-top: 4px;
      text-align: center;
    }
    .arl-profit-badge.profit {
      color: #3fb950;
      background-color: rgba(63, 185, 80, 0.15);
    }
     .arl-profit-badge.loss {
      color: #f85149;
      background-color: rgba(248, 81, 73, 0.15);
    }

    /* --- Inline Fast Book Button --- */
    .arl-inline-fast-book-btn {
      /* Reset for flexbox */
      background: none;
      border: none;
      padding: 0;
      margin: 0 12px; /* Symmetrical margin for both layouts */
      
      /* Flex properties */
      display: flex !important;
      align-items: center;
      justify-content: center;
      align-self: center; /* Vertically center in the row */
      flex-shrink: 0; /* Prevent shrinking on small screens */

      /* Visual Style (Pill Button) */
      padding: 8px 16px !important;
      background-color: var(--arl-primary) !important;
      color: white !important;
      border-radius: 30px !important; /* Rounded pill shape */
      font-size: 13px !important;
      font-weight: 600 !important;
      white-space: nowrap; /* Prevent "Fast Book" from wrapping */
      cursor: pointer !important;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2) !important;
      transition: transform 0.2s ease, background-color 0.2s ease !important;
    }
    .arl-inline-fast-book-btn:hover {
        background-color: var(--arl-success) !important;
        transform: scale(1.1) !important;
    }

    /* Make the button smaller on desktop screens */
    @media (min-width: 1024px) {
      .arl-inline-fast-book-btn {
        padding: 6px 6px !important; /* Halved horizontal padding for a tighter look */
        font-size: 12px !important;
      }
    }
    
    /* --- Priority Lane --- */
    #arl-priority-lane {
      display: none; /* Hidden by default */
      margin-bottom: 20px;
    }
    .arl-priority-header {
      font-size: 16px;
      font-weight: 600;
      color: var(--arl-text-muted);
      margin-bottom: 10px;
      padding-bottom: 5px;
      border-bottom: 1px solid var(--arl-border);
    }
    
    @keyframes arl-slide-in {
      from {
        opacity: 0;
        transform: translateX(-20px);
      }
      to {
        opacity: 1;
        transform: translateX(0);
      }
    }

    @keyframes arl-pulse-glow {
      0% { box-shadow: 0 0 0 0 rgba(78, 128, 238, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(78, 128, 238, 0); }
      100% { box-shadow: 0 0 0 0 rgba(78, 128, 238, 0); }
    }
    .new-load-highlight {
      border: 2px solid var(--arl-primary) !important;
      background-color: rgba(78, 128, 238, 0.15) !important;
      animation: arl-pulse-glow 1.5s infinite, arl-slide-in 0.5s ease-out;
      position: relative !important;
      margin-bottom: 16px !important;
      transform: scale(1.01);
      transition: transform 0.3s ease-in-out;
    }
    .new-load-badge {
      position: absolute; top: 0; left: 0;
      background: var(--arl-primary);
      color: white; padding: 2px 6px;
      border-bottom-right-radius: 8px;
      font-size: 10px; font-weight: 500;
      line-height: 1.2;
    }

    @keyframes arl-pulse-glow-gold {
      0% { box-shadow: 0 0 0 0 rgba(255, 196, 0, 0.7); }
      70% { box-shadow: 0 0 0 10px rgba(255, 196, 0, 0); }
      100% { box-shadow: 0 0 0 0 rgba(255, 196, 0, 0); }
    }

    .price-update-highlight {
      border: 2px solid #ffc400 !important;
      background-color: rgba(255, 196, 0, 0.1) !important;
      animation: arl-pulse-glow-gold 1.5s infinite;
      position: relative !important;
    }

    .price-update-badge {
      position: absolute; top: 0; left: 0;
      background: #ffc400;
      color: #1c1c1e;
      padding: 3px 8px;
      border-bottom-right-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.2;
    }
  `;

  function waitAndInjectPanel() {
    let attempts = 0;
    const interval = setInterval(() => {
      attempts++;
      const searchPanel = document.querySelector(".search__panel");
      if (searchPanel) {
        // First, inject styles if they don't exist
        if (!document.getElementById("arl-styles")) {
          const styleSheet = document.createElement("style");
          styleSheet.id = "arl-styles";
          styleSheet.innerText = styles;
          document.head.appendChild(styleSheet);
        }

        // Then, inject the Priority Lane container if it doesn't exist
        const loadListContainer = document.querySelector('[role="list"]');
        if (
          loadListContainer &&
          !document.getElementById("arl-priority-lane")
        ) {
          const priorityLaneHTML = `
            <div id="arl-priority-lane">
              <h3 class="arl-priority-header">Newly Detected</h3>
            </div>
          `;
          loadListContainer.insertAdjacentHTML("beforebegin", priorityLaneHTML);
        }

        // Then, inject the panel if it doesn't exist
        if (!document.getElementById("amazon-relay-detector-panel")) {
          searchPanel.insertAdjacentHTML("beforeend", controlPanelHTML);
          applySettingsToUI();
          attachListeners();
          // Show profit calculations initially since monitoring is not active
          setTimeout(() => {
            if (!isDetectionActive) {
              showProfitCalculation();
            }
          }, 500);
        }
        clearInterval(interval);
      }
      if (attempts > 30) clearInterval(interval);
    }, 300);
  }

  function applySettingsToUI() {
    currentSettings = loadSettings();

    // Apply to script variables
    baseDelay = currentSettings.baseDelay;
    randomDelay = currentSettings.randomDelay;

    // Apply to UI elements
    document.getElementById("arl-base-speed").value = baseDelay;
    document.getElementById(
      "arl-base-speed-value"
    ).textContent = `${baseDelay}ms`;

    document.getElementById("arl-randomizer").value = randomDelay;
    document.getElementById(
      "arl-randomizer-value"
    ).textContent = `${randomDelay}ms`;

    document.getElementById("arl-min-price-increase").value =
      currentSettings.minPriceIncrease;
    document.getElementById("arl-autobooker-toggle").checked =
      currentSettings.autobooker;
    document.getElementById("arl-fastbook-toggle").checked =
      currentSettings.fastBook;

    // Profit Calculator settings
    document.getElementById("arl-profit-toggle").checked =
      currentSettings.showProfitCalculator;
    document.getElementById("arl-mpg-input").value = currentSettings.truckMPG;
    document.getElementById("arl-fuel-price-input").value =
      currentSettings.fuelPrice;

    // Blacklist setting
    document.getElementById("arl-blacklist-input").value = (
      currentSettings.blacklist || []
    ).join(", ");
  }

  function attachListeners() {
    const startBtn = document.getElementById("arl-start-btn");
    const stopBtn = document.getElementById("arl-stop-btn");
    const speedInput = document.getElementById("arl-base-speed");
    const randomInput = document.getElementById("arl-randomizer");
    const speedValue = document.getElementById("arl-base-speed-value");
    const randomValue = document.getElementById("arl-randomizer-value");
    const statusText = document.getElementById("arl-status-text");
    const statusIndicator = document.getElementById("arl-status-indicator");
    const settingsBtn = document.getElementById("arl-settings-btn");
    const settingsPanel = document.getElementById("arl-settings-panel");

    // Settings controls
    const minPriceInput = document.getElementById("arl-min-price-increase");
    const autobookerToggle = document.getElementById("arl-autobooker-toggle");
    const fastbookToggle = document.getElementById("arl-fastbook-toggle");

    // Profit Calculator listeners
    const profitToggle = document.getElementById("arl-profit-toggle");
    const mpgInput = document.getElementById("arl-mpg-input");
    const fuelPriceInput = document.getElementById("arl-fuel-price-input");
    const blacklistInput = document.getElementById("arl-blacklist-input");

    stopBtn.disabled = true;

    speedInput.addEventListener("input", () => {
      baseDelay = parseInt(speedInput.value, 10);
      speedValue.textContent = `${baseDelay}ms`;
      currentSettings.baseDelay = baseDelay;
      saveSettings(currentSettings);
    });

    randomInput.addEventListener("input", () => {
      randomDelay = parseInt(randomInput.value, 10);
      randomValue.textContent = `${randomDelay}ms`;
      currentSettings.randomDelay = randomDelay;
      saveSettings(currentSettings);
    });

    startBtn.addEventListener("click", () => {
      if (isDetectionActive) return;
      isDetectionActive = true;
      statusText.textContent = "Monitoring";
      statusIndicator.style.backgroundColor = "var(--arl-success)";
      startBtn.disabled = true;
      stopBtn.disabled = false;
      // Hide profit calculations when monitoring starts
      hideProfitCalculation();
      startMonitoring();
    });

    stopBtn.addEventListener("click", () => {
      stopMonitoring("Stopped ");
      // Show profit calculation when stop button is clicked
      showProfitCalculation();
    });

    settingsBtn.addEventListener("click", () => {
      const isHidden = settingsPanel.style.display === "none";
      settingsPanel.style.display = isHidden ? "block" : "none";
    });

    // --- Listeners for saving settings ---
    minPriceInput.addEventListener("input", () => {
      const value = parseFloat(minPriceInput.value);
      if (!isNaN(value)) {
        currentSettings.minPriceIncrease = value;
        saveSettings(currentSettings);
      }
    });

    autobookerToggle.addEventListener("change", () => {
      currentSettings.autobooker = autobookerToggle.checked;
      saveSettings(currentSettings);
    });

    fastbookToggle.addEventListener("change", () => {
      currentSettings.fastBook = fastbookToggle.checked;
      saveSettings(currentSettings);
    });

    // --- Listeners for Profit Calculator ---
    profitToggle.addEventListener("change", () => {
      currentSettings.showProfitCalculator = profitToggle.checked;
      saveSettings(currentSettings);
      // Update profit display when setting changes (only if not monitoring)
      if (!isDetectionActive) {
        if (currentSettings.showProfitCalculator) {
          showProfitCalculation();
        } else {
          hideProfitCalculation();
        }
      }
    });

    mpgInput.addEventListener("input", () => {
      const value = parseFloat(mpgInput.value);
      if (!isNaN(value)) {
        currentSettings.truckMPG = value;
        saveSettings(currentSettings);
        // Update profit display when MPG changes (only if not monitoring)
        if (!isDetectionActive && currentSettings.showProfitCalculator) {
          showProfitCalculation();
        }
      }
    });

    fuelPriceInput.addEventListener("input", () => {
      const value = parseFloat(fuelPriceInput.value);
      if (!isNaN(value)) {
        currentSettings.fuelPrice = value;
        saveSettings(currentSettings);
        // Update profit display when fuel price changes (only if not monitoring)
        if (!isDetectionActive && currentSettings.showProfitCalculator) {
          showProfitCalculation();
        }
      }
    });

    // --- Listener for Blacklist ---
    blacklistInput.addEventListener("input", () => {
      const keywords = blacklistInput.value
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
      currentSettings.blacklist = keywords;
      saveSettings(currentSettings);
    });
  }

  waitAndInjectPanel();
}

setupUI();

function showProfitCalculation() {
  if (!currentSettings.showProfitCalculator) return;

  const searchRoot = document.getElementById("active-tab-body");
  if (!searchRoot) return;

  const currentCards = Array.from(
    searchRoot.querySelectorAll(".load-card, .wo-card-header--highlighted")
  );

  currentCards.forEach((card) => {
    const { id, price, miles } = getCardDetails(card);
    if (!id) return;

    // Remove any old profit badge before adding a new one
    const oldProfitBadge = card.querySelector(".arl-profit-badge");
    if (oldProfitBadge) oldProfitBadge.remove();

    const payout = parsePrice(price);
    const tripMiles = parsePrice(miles);
    const mpg = currentSettings.truckMPG;
    const fuelPrice = currentSettings.fuelPrice;

    if (payout && tripMiles && mpg > 0 && fuelPrice > 0) {
      const fuelCost = (tripMiles / mpg) * fuelPrice;
      const profit = payout - fuelCost;

      const profitBadge = document.createElement("div");
      profitBadge.className = "arl-profit-badge";
      if (profit >= 0) {
        profitBadge.classList.add("profit");
        profitBadge.textContent = `Profit: +$${profit.toFixed(2)}`;
      } else {
        profitBadge.classList.add("loss");
        profitBadge.textContent = `Profit: -$${Math.abs(profit).toFixed(2)}`;
      }

      // Inject badge into the price container
      const desktopPriceContainer = card.querySelector(
        ".css-1xqwq2z .css-1dk3tf8"
      );
      const mobilePriceContainer = card.querySelector(
        ".css-ntd8uw .css-1dk3tf8"
      );
      const targetContainer = desktopPriceContainer || mobilePriceContainer;
      if (targetContainer) {
        targetContainer.appendChild(profitBadge);
      }
    }
  });
}

function hideProfitCalculation() {
  const searchRoot = document.getElementById("active-tab-body");
  if (!searchRoot) return;

  const allProfitBadges = searchRoot.querySelectorAll(".arl-profit-badge");
  allProfitBadges.forEach((badge) => badge.remove());
}

function stopMonitoring(message = "Stopped") {
  if (!isDetectionActive && message !== "Stopped (New load)") return;
  isDetectionActive = false;

  const statusText = document.getElementById("arl-status-text");
  const statusIndicator = document.getElementById("arl-status-indicator");
  const startBtn = document.getElementById("arl-start-btn");
  const stopBtn = document.getElementById("arl-stop-btn");

  if (statusText) statusText.textContent = message;
  if (statusIndicator)
    statusIndicator.style.backgroundColor = "var(--arl-danger)";

  if (startBtn) startBtn.disabled = false;
  if (stopBtn) stopBtn.disabled = true;

  clearTimeout(detectionTimeout);
  console.log(` Detection stopped. Reason: ${message}`);

  // Show profit calculation when monitoring stops
  showProfitCalculation();
}

function getCardDetails(cardElement) {
  const id = cardElement.querySelector("div[id]")?.id;
  const priceElement = cardElement.querySelector(
    ".wo-total_payout, .wo-total_payout__modified-load-increase-attr"
  );
  const price = priceElement ? priceElement.textContent.trim() : null;

  // Find all spans containing "mi", then filter out the one for deadhead.
  const allMileSpans = Array.from(cardElement.querySelectorAll("span")).filter(
    (s) => s.textContent.includes(" mi")
  );
  const deadheadSpan = cardElement.querySelector("span[title='Deadhead']");
  const tripMilesSpan = allMileSpans.find(
    (s) =>
      !s.parentElement.contains(deadheadSpan) && !s.textContent.includes("/mi")
  );

  const milesText = tripMilesSpan ? tripMilesSpan.textContent.trim() : null;

  // Get origin and destination text for blacklist checking
  const locationSpans = Array.from(
    cardElement.querySelectorAll(".wo-card-header__components")
  );
  const originText = locationSpans[0] ? locationSpans[0].textContent : "";
  const destinationText = locationSpans[1] ? locationSpans[1].textContent : "";

  return {
    id,
    price,
    miles: milesText,
    origin: originText,
    destination: destinationText,
  };
}

function parsePrice(priceString) {
  if (!priceString) return null;
  // Remove dollar signs, commas, and any non-numeric characters except the decimal point.
  const cleanedString = priceString.replace(/[^0-9.]/g, "");
  return parseFloat(cleanedString);
}

function startMonitoring() {
  console.log("👀 Starting monitoring...");

  const seenLoadDetails = new Map(); // Upgraded to a Map
  const searchRoot = document.getElementById("active-tab-body");

  if (searchRoot) {
    const allCards = Array.from(
      searchRoot.querySelectorAll(".load-card, .wo-card-header--highlighted")
    );

    allCards.forEach((card) => {
      const { id, price } = getCardDetails(card);
      if (id) {
        seenLoadDetails.set(id, price);
      }
    });
  } else {
    // If we can't find the container, start anyway.
    console.log(
      "ℹ️ No load container found. Starting monitoring with empty list."
    );
  }

  function detectionCycle() {
    if (!isDetectionActive) {
      console.log("🛑 Detection stopped. Exiting cycle.");
      return;
    }

    clickRefreshButton();

    detectionTimeout = setTimeout(() => {
      const searchRoot = document.getElementById("active-tab-body");
      if (!searchRoot) {
        console.log(
          "ℹ️ No load container found after refresh. Continuing loop."
        );
        const totalDelay = baseDelay + Math.floor(Math.random() * randomDelay);
        detectionTimeout = setTimeout(detectionCycle, totalDelay);
        return;
      }

      const minPriceIncrease = currentSettings.minPriceIncrease || 5;

      const currentCards = Array.from(
        searchRoot.querySelectorAll(".load-card, .wo-card-header--highlighted")
      );

      const newOrUpdatedLoads = [];
      const currentLoadDetails = new Map();
      const blacklistSet = new Set(
        (currentSettings.blacklist || []).map((k) => k.toUpperCase())
      );

      currentCards.forEach((card) => {
        const { id, price, origin, destination } = getCardDetails(card);
        if (!id) return; // Skip cards without an ID

        currentLoadDetails.set(id, price);

        const storedPrice = seenLoadDetails.get(id);

        if (!seenLoadDetails.has(id) && !globallySeenNewLoads.has(id)) {
          // It's a genuinely new load. Now, check against the blacklist.
          const originUpper = origin.toUpperCase();
          const destUpper = destination.toUpperCase();

          const isBlacklisted = (currentSettings.blacklist || []).some(
            (keyword) => {
              const upperKeyword = keyword.toUpperCase();
              return (
                originUpper.includes(upperKeyword) ||
                destUpper.includes(upperKeyword)
              );
            }
          );

          if (!isBlacklisted) {
            // This is a brand new, non-blacklisted load
            newOrUpdatedLoads.push({ id, card, type: "new" });
          } else {
            console.log(
              `ARL: Ignoring new load ${id} because it is blacklisted.`
            );
            // Silently ignore, it will be added to seenLoadDetails at the end of the cycle.
          }
        } else if (price && storedPrice !== price) {
          // This is a price update
          const oldPriceNum = parsePrice(storedPrice);
          const newPriceNum = parsePrice(price);

          if (oldPriceNum !== null && newPriceNum !== null) {
            const difference = newPriceNum - oldPriceNum;

            // Check if the price increase meets the minimum requirement
            if (difference >= minPriceIncrease) {
              newOrUpdatedLoads.push({
                id,
                card,
                type: "price_update",
                oldPrice: storedPrice,
                newPrice: price,
                difference: difference,
              });
            }
          }
        }
      });

      // --- Profit calculation is moved to showProfitCalculation() function ---
      // This will only be shown when monitoring is stopped

      console.log("🆕 New or Updated Loads:", newOrUpdatedLoads);

      if (newOrUpdatedLoads.length > 0) {
        console.log("🎉 Changes detected! Stopping detection.");
        playSound();

        const priorityLane = document.getElementById("arl-priority-lane");
        if (priorityLane) priorityLane.style.display = "block";

        for (const load of newOrUpdatedLoads) {
          // Clean up any old highlights or badges first
          load.card.classList.remove(
            "new-load-highlight",
            "price-update-highlight"
          );
          const existingHighlightBadge = load.card.querySelector(
            ".new-load-badge, .price-update-badge"
          );
          if (existingHighlightBadge) existingHighlightBadge.remove();

          const badge = document.createElement("div");

          if (load.type === "new") {
            globallySeenNewLoads.add(load.id); // Add to the master seen list
            load.card.classList.add("new-load-highlight");
            badge.className = "new-load-badge";
            badge.textContent = "New";

            if (currentSettings.fastBook) {
              // 1. Create the button. The style is the same for both layouts.
              const fastBookBtn = document.createElement("button");
              fastBookBtn.className = "arl-inline-fast-book-btn";
              fastBookBtn.textContent = "Fast Book";
              fastBookBtn.addEventListener("click", (e) => {
                console.log(`booking load with load id of ${load.id}`);
                e.stopPropagation();

                // Click the first child of the load card to open details
                const clickableElement = load.card.firstElementChild;
                if (clickableElement) {
                  clickableElement.click();
                  // Call the new helper function to wait for and click the book button
                  waitForAndClickBookButton();
                } else {
                  console.warn(
                    "ARL: Could not find the specific child element, falling back to clicking the card.",
                    load.id
                  );
                  load.card.click(); // Fallback
                }
              });

              // 2. Try to inject using the DESKTOP/TABLET layout structure.
              const desktopPriceColumn =
                load.card.querySelector(".css-1xqwq2z");
              if (desktopPriceColumn && desktopPriceColumn.parentElement) {
                // Insert the button right before the entire price column.
                desktopPriceColumn.parentElement.insertBefore(
                  fastBookBtn,
                  desktopPriceColumn
                );
              }
              // 3. FALLBACK: Try to inject using the MOBILE layout structure.
              else {
                const mobilePriceContainer =
                  load.card.querySelector(".css-ntd8uw");
                if (mobilePriceContainer) {
                  // On mobile, prepend the button to the container that holds the price and the arrow.
                  mobilePriceContainer.prepend(fastBookBtn);
                } else {
                  console.warn(
                    "⚠️ ARL: Could not find a suitable location for the Fast Book button.",
                    load.id
                  );
                }
              }
            }
          } else if (load.type === "price_update") {
            load.card.classList.add("price-update-highlight");
            badge.className = "price-update-badge";
            if (load.difference !== null) {
              const sign = load.difference > 0 ? "+" : "";
              badge.textContent = `${sign}$${load.difference.toFixed(2)}`;
            } else {
              badge.textContent = `Update`;
            }
          }

          load.card.appendChild(badge);

          const woTagElement = load.card.querySelector(".wo-tag");
          if (woTagElement) woTagElement.remove();

          if (priorityLane) {
            priorityLane.prepend(load.card);
          } else {
            load.card.parentElement?.prepend(load.card);
          }
        }
        stopMonitoring("Changes detected");
      } else {
        console.log("✅ No changes found. Continuing loop.");
        // Update the master list for the next cycle
        seenLoadDetails.clear();
        currentLoadDetails.forEach((price, id) =>
          seenLoadDetails.set(id, price)
        );
        const totalDelay = baseDelay + Math.floor(Math.random() * randomDelay);
        detectionTimeout = setTimeout(detectionCycle, totalDelay);
      }
    }, 800);
  }
  const initialDelay = baseDelay + Math.floor(Math.random() * randomDelay);
  detectionTimeout = setTimeout(detectionCycle, initialDelay);
}

function waitForAndClickBookButton() {
  let attempts = 0;
  const maxAttempts = 50; // Try for 5 seconds (50 * 100ms)
  const interval = setInterval(() => {
    // Find the 'Book' button inside the details panel
    const bookButton = document.querySelector("button#rlb-book-btn");

    if (bookButton) {
      console.log("ARL: Found 'Book' button. Clicking it now.");
      bookButton.click();
      clearInterval(interval); // Stop searching once found and clicked
      waitForAndClickConfirmButton();
      return;
    }

    attempts++;
    if (attempts > maxAttempts) {
      console.warn("ARL: Timed out waiting for the 'Book' button to appear.");
      clearInterval(interval);
    }
  }, 100);
}

function waitForAndClickConfirmButton() {
  let attempts = 0;
  const maxAttempts = 50; // Try for 5 seconds
  const interval = setInterval(() => {
    // Find the final 'Yes, confirm booking' button by its unique ID
    const confirmButton = document.querySelector(
      "button#rlb-book-trip-confirm-booking-btn"
    );

    if (confirmButton) {
      console.log(
        "ARL: Found final confirmation button. Clicking to confirm booking."
      );
      confirmButton.click();
      clearInterval(interval); // Final step, stop searching
      return;
    }

    attempts++;
    if (attempts > maxAttempts) {
      console.warn("ARL: Timed out waiting for the final confirmation button.");
      clearInterval(interval);
    }
  }, 100);
}

function playSound() {
  const audio = new Audio(chrome.runtime.getURL("cash.mp3"));
  audio.play().catch((e) => console.warn("🔇 Failed to play sound:", e));
}
