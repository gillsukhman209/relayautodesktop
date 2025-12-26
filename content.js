// ExtPay Integration
const extpay = ExtPay("relay-ai-booker");

// Debug logging
const DEBUG = true;
function log(context, message, data = null) {
  if (!DEBUG) return;
  const prefix = `[ContentScript:${context}]`;
  if (data) {
    console.log(prefix, message, data);
  } else {
    console.log(prefix, message);
  }
}

log('init', 'Content script starting...');

let isDetectionActive = false;
let detectionTimeout;
let baseDelay = 800;
let randomDelay = 500;
let globallySeenNewLoads = new Set();
let isPaidUser = false;
let userPaymentStatus = null;

const SETTINGS_KEY = "amazonRelayLoadDetectorSettings";
let currentSettings = {};
let panelWatchdog = null;

// Limit globallySeenNewLoads to prevent memory leaks
const MAX_SEEN_LOADS = 1000;

const defaultSettings = {
  baseDelay: 800,
  randomDelay: 500,
  minPriceIncrease: 5,
  autobooker: false,
  fastBook: false,
  showProfitCalculator: true,
  truckMPG: 6.5,
  fuelPrice: 4.5,
  blacklist: [],
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
    return saved
      ? { ...defaultSettings, ...JSON.parse(saved) }
      : defaultSettings;
  } catch (e) {
    console.error("Failed to load settings, using defaults:", e);
    return defaultSettings;
  }
}

function clickRefreshButton() {
  log('clickRefreshButton', 'Looking for refresh button...');
  const refreshBtn = ElementFinder.findRefreshButton();
  if (refreshBtn) {
    log('clickRefreshButton', 'Found and clicking refresh button');
    refreshBtn.click();
  } else {
    log('clickRefreshButton', 'Refresh button NOT found');
  }
}

// Temporarily force paid status for free access
async function checkPaymentStatus() {
  isPaidUser = true;
  return true;
}

// Update Subscription Status Display
function updateSubscriptionDisplay(user) {
  const statusElement = document.getElementById("arl-sub-status");
  const billingElement = document.getElementById("arl-sub-billing");

  if (!statusElement || !billingElement) return;

  statusElement.className = "arl-sub-value";
  if (user.subscriptionStatus === "active") {
    statusElement.textContent = "Active";
    statusElement.classList.add("active");
  } else if (user.subscriptionStatus === "past_due") {
    statusElement.textContent = "Past Due";
    statusElement.classList.add("warning");
  } else if (user.subscriptionStatus === "canceled") {
    statusElement.textContent = "Canceled";
    statusElement.classList.add("error");
  } else {
    statusElement.textContent = user.subscriptionStatus || "Unknown";
  }

  if (user.subscriptionCancelAt) {
    const cancelDate = new Date(user.subscriptionCancelAt);
    billingElement.textContent = `Ends ${cancelDate.toLocaleDateString()}`;
    billingElement.className = "arl-sub-value warning";
  } else if (user.subscriptionStatus === "active") {
    const paidDate = new Date(user.paidAt);
    const nextBilling = new Date(paidDate);
    nextBilling.setMonth(paidDate.getMonth() + 1);
    billingElement.textContent = nextBilling.toLocaleDateString();
    billingElement.className = "arl-sub-value";
  } else {
    billingElement.textContent = "N/A";
    billingElement.className = "arl-sub-value";
  }
}

// Payment Required UI
function setupPaymentUI() {
  const paymentHTML = `
    <div id="amazon-relay-detector-payment-panel">
      <div class="arl-payment-hero">
        <h2 class="arl-payment-title">Smart Amazon Relay Refresher Pro</h2>
        <p class="arl-payment-subtitle">Professional Load Detection System</p>
      </div>

      <div class="arl-value-grid">
        <div class="arl-value-item">
          <div class="arl-value-icon">⚡</div>
          <div class="arl-value-text">
            <h4>Instant Detection</h4>
            <p>Catch new loads within seconds</p>
          </div>
        </div>
        <div class="arl-value-item">
          <div class="arl-value-icon">💰</div>
          <div class="arl-value-text">
            <h4>ROI Calculator</h4>
            <p>See profit margins instantly</p>
          </div>
        </div>
        <div class="arl-value-item">
          <div class="arl-value-icon">🎯</div>
          <div class="arl-value-text">
            <h4>Smart Filtering</h4>
            <p>Blacklist unwanted routes</p>
          </div>
        </div>
        <div class="arl-value-item">
          <div class="arl-value-icon">🤖</div>
          <div class="arl-value-text">
            <h4>Auto Booking</h4>
            <p>One-click load booking</p>
          </div>
        </div>
      </div>

      <div class="arl-pricing-section">
        <div class="arl-price-tag">
          <div class="arl-price-main">$50<span class="arl-price-period">/month</span></div>
          <div class="arl-price-subtitle">Professional License</div>
        </div>
        <div class="arl-roi-note">
          <span class="arl-roi-icon">📈</span>
          <span>Typically pays for itself with just 1-2 loads caught per month</span>
        </div>
      </div>

      <button id="arl-upgrade-btn" class="arl-upgrade-button">
        <span class="arl-upgrade-text">Upgrade to Pro</span>
        <span class="arl-upgrade-arrow">→</span>
      </button>

      <div class="arl-payment-footer">
        <p>✓ Secure payment via Stripe</p>
        <p>✓ Cancel anytime</p>
        <p>✓ Works across all browsers</p>
      </div>
    </div>
  `;

  const paymentStyles = `
    #amazon-relay-detector-payment-panel {
      position: relative;
      margin-top: 16px;
      z-index: 999999;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
      color: #ffffff;
      border: 1px solid #00d4ff;
      border-radius: 20px;
      padding: 32px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      box-shadow:
        0 0 30px rgba(0, 212, 255, 0.3),
        0 10px 50px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      min-width: 350px;
      max-width: 450px;
      width: 100%;
      box-sizing: border-box;
      overflow: hidden;
    }

    #amazon-relay-detector-payment-panel::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, #00d4ff, #0066ff, #00d4ff);
      animation: arl-border-glow 2s ease-in-out infinite;
    }

    @keyframes arl-border-glow {
      0%, 100% { opacity: 0.8; }
      50% { opacity: 1; }
    }

    .arl-payment-hero {
      text-align: center;
      margin-bottom: 32px;
    }

    .arl-payment-title {
      font-size: 28px;
      font-weight: 700;
      margin: 0 0 12px 0;
      background: linear-gradient(135deg, #00d4ff, #0066ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1.2;
    }

    .arl-payment-subtitle {
      font-size: 16px;
      color: #a0a0a0;
      margin: 0;
    }

    .arl-value-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 32px;
    }

    .arl-value-item {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 12px;
      border: 1px solid rgba(0, 212, 255, 0.2);
      transition: all 0.3s ease;
    }

    .arl-value-item:hover {
      border-color: rgba(0, 212, 255, 0.5);
      transform: translateY(-2px);
    }

    .arl-value-icon {
      font-size: 24px;
      flex-shrink: 0;
      margin-top: 2px;
    }

    .arl-value-text h4 {
      margin: 0 0 6px 0;
      font-size: 15px;
      font-weight: 600;
      color: #ffffff;
      line-height: 1.2;
    }

    .arl-value-text p {
      margin: 0;
      font-size: 13px;
      color: #a0a0a0;
      line-height: 1.4;
    }

    .arl-pricing-section {
      text-align: center;
      margin: 32px 0;
      padding: 24px;
      background: rgba(0, 212, 255, 0.1);
      border-radius: 16px;
      border: 1px solid rgba(0, 212, 255, 0.3);
    }

    .arl-price-tag {
      margin-bottom: 16px;
    }

    .arl-price-main {
      font-size: 36px;
      font-weight: 800;
      color: #00d4ff;
      line-height: 1;
    }

    .arl-price-period {
      font-size: 18px;
      font-weight: 400;
      color: #a0a0a0;
    }

    .arl-price-subtitle {
      font-size: 14px;
      color: #ffffff;
      margin-top: 4px;
    }

    .arl-roi-note {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-size: 14px;
      color: #a0a0a0;
      font-style: italic;
      margin-top: 4px;
    }

    .arl-roi-icon {
      font-size: 14px;
    }

    .arl-upgrade-button {
      width: 100%;
      padding: 20px 24px;
      background: linear-gradient(135deg, #00d4ff 0%, #0066ff 100%);
      border: none;
      border-radius: 16px;
      color: #ffffff;
      font-size: 20px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      transition: all 0.3s ease;
      box-shadow:
        0 4px 15px rgba(0, 212, 255, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
      margin-bottom: 24px;
    }

    .arl-upgrade-button:hover {
      transform: translateY(-2px);
      box-shadow:
        0 6px 20px rgba(0, 212, 255, 0.6),
        inset 0 1px 0 rgba(255, 255, 255, 0.2);
    }

    .arl-upgrade-button:active {
      transform: translateY(0);
    }

    .arl-upgrade-arrow {
      font-size: 20px;
      transition: transform 0.3s ease;
    }

    .arl-upgrade-button:hover .arl-upgrade-arrow {
      transform: translateX(4px);
    }

    .arl-payment-footer {
      text-align: center;
    }

    .arl-payment-footer p {
      margin: 6px 0;
      font-size: 14px;
      color: #a0a0a0;
    }

    @media (max-width: 500px) {
      #amazon-relay-detector-payment-panel {
        min-width: 280px;
        max-width: 350px;
        padding: 20px;
      }

      .arl-value-grid {
        grid-template-columns: 1fr;
        gap: 12px;
      }
    }
  `;

  return { paymentHTML, paymentStyles };
}

function setupUI() {
  const controlPanelHTML = `
    <div id="amazon-relay-detector-panel">
      <div class="arl-header">
        <span class="arl-title">Smart Amazon Relay Refresher</span>
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
        <input type="range" id="arl-base-speed" min="300" max="2000" step="100" value="800">
      </div>

      <div class="arl-slider-group">
        <label for="arl-randomizer">Randomizer: <span id="arl-randomizer-value" class="arl-slider-value">500ms</span></label>
        <input type="range" id="arl-randomizer" min="0" max="2000" step="50" value="500">
      </div>

      <div class="arl-button-group">
        <button id="arl-start-btn" class="arl-btn arl-btn-start">Start</button>
        <button id="arl-stop-btn" class="arl-btn arl-btn-stop">Stop</button>
      </div>

      <div id="arl-settings-panel" style="display: none;">
        <h4 class="arl-settings-title">Settings</h4>
        <div class="arl-setting arl-setting-disabled">
          <label for="arl-autobooker-toggle">Autobooker <span class="arl-coming-soon">Coming Soon</span></label>
          <label class="arl-toggle-switch arl-toggle-disabled">
            <input type="checkbox" id="arl-autobooker-toggle" disabled>
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

        <h4 class="arl-settings-title" style="margin-top: 20px; border-top: 1px solid var(--arl-border); padding-top: 15px;">Subscription</h4>

        <div id="arl-subscription-status" class="arl-subscription-status">
          <div class="arl-sub-info">
            <span class="arl-sub-label">Status:</span>
            <span id="arl-sub-status" class="arl-sub-value">Loading...</span>
          </div>
          <div class="arl-sub-info">
            <span class="arl-sub-label">Plan:</span>
            <span class="arl-sub-plan">$50/month</span>
          </div>
          <div class="arl-sub-info">
            <span class="arl-sub-label">Next billing:</span>
            <span id="arl-sub-billing" class="arl-sub-value">Loading...</span>
          </div>
        </div>

        <div class="arl-setting-full-width">
          <button id="arl-manage-subscription-btn" class="arl-manage-sub-btn">
            Manage Subscription
          </button>
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
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
      color: var(--arl-text);
      border: 1px solid #00d4ff;
      border-radius: 16px;
      padding: 20px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      box-shadow:
        0 0 30px rgba(0, 212, 255, 0.3),
        0 10px 50px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      min-width: 280px;
      max-width: 400px;
      width: 100%;
      box-sizing: border-box;
      flex-shrink: 0;
      overflow: visible;
    }

    #amazon-relay-detector-panel::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 2px;
      background: linear-gradient(90deg, #00d4ff, #0066ff, #00d4ff);
      border-radius: 16px 16px 0 0;
      animation: arl-border-glow 2s ease-in-out infinite;
    }

    @keyframes arl-border-glow {
      0%, 100% { opacity: 0.8; }
      50% { opacity: 1; }
    }

    @media (max-width: 500px) {
      #amazon-relay-detector-panel {
        min-width: 200px;
        max-width: 300px;
        padding: 12px;
        margin-left: auto;
        margin-right: auto;
        left: 50%;
        transform: translateX(-50%);
      }
    }

    @media (max-width: 400px) {
      #amazon-relay-detector-panel {
        min-width: 180px;
        max-width: 250px;
        padding: 10px;
        margin-left: auto;
        margin-right: auto;
        left: 50%;
        transform: translateX(-50%);
      }
    }
    .arl-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      position: relative;
      z-index: 2;
    }
    .arl-title {
      font-size: 20px;
      font-weight: 700;
      background: linear-gradient(135deg, #00d4ff, #0066ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      filter: drop-shadow(0 0 10px rgba(0, 212, 255, 0.3));
    }
    .arl-header-controls { display: flex; align-items: center; gap: 12px; }
    #arl-status-container {
      display: flex;
      align-items: center;
      background: rgba(255, 255, 255, 0.05);
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid rgba(0, 212, 255, 0.2);
      backdrop-filter: blur(10px);
    }
    #arl-status-indicator {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 8px;
      background-color: var(--arl-danger);
      transition: all 0.3s ease;
      box-shadow: 0 0 10px currentColor;
    }
    #arl-status-text {
      font-size: 12px;
      font-weight: 600;
      color: var(--arl-text);
      text-shadow: 0 0 10px rgba(255, 255, 255, 0.3);
    }

    .arl-slider-group {
      margin-bottom: 20px;
      padding: 16px;
      background: rgba(255, 255, 255, 0.03);
      border-radius: 12px;
      border: 1px solid rgba(0, 212, 255, 0.15);
    }
    .arl-slider-group label {
      font-size: 14px;
      color: var(--arl-text);
      font-weight: 600;
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .arl-slider-value {
      color: #00d4ff;
      font-weight: 700;
      text-shadow: 0 0 10px rgba(0, 212, 255, 0.5);
    }

    input[type="range"]#arl-base-speed, input[type="range"]#arl-randomizer {
      -webkit-appearance: none !important;
      appearance: none !important;
      width: 100% !important;
      height: 8px !important;
      background: linear-gradient(to right, #1a1a2e, #16213e) !important;
      border-radius: 6px !important;
      outline: none !important;
      border: 1px solid rgba(0, 212, 255, 0.3) !important;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.3) !important;
    }
    input[type="range"]#arl-base-speed::-webkit-slider-thumb, input[type="range"]#arl-randomizer::-webkit-slider-thumb {
      -webkit-appearance: none !important;
      appearance: none !important;
      width: 20px !important;
      height: 20px !important;
      background: linear-gradient(135deg, #00d4ff, #0066ff) !important;
      cursor: pointer !important;
      border-radius: 50% !important;
      border: 2px solid #ffffff !important;
      box-shadow:
        0 0 15px rgba(0, 212, 255, 0.6),
        0 2px 8px rgba(0, 0, 0, 0.3) !important;
      transition: all 0.2s ease !important;
    }
    input[type="range"]#arl-base-speed::-webkit-slider-thumb:hover, input[type="range"]#arl-randomizer::-webkit-slider-thumb:hover {
      transform: scale(1.1) !important;
      box-shadow:
        0 0 20px rgba(0, 212, 255, 0.8),
        0 4px 12px rgba(0, 0, 0, 0.4) !important;
    }

    .arl-button-group { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 16px; }
    .arl-btn {
      border: none;
      padding: 14px 20px;
      border-radius: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }
    .arl-btn-start {
      background: linear-gradient(135deg, #00d4ff, #0066ff);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .arl-btn-stop {
      background: linear-gradient(135deg, #ff4757, #ff3742);
      color: white;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .arl-btn:hover {
      transform: translateY(-2px);
      opacity: 1;
    }
    .arl-btn-start:hover {
      box-shadow:
        0 0 25px rgba(0, 212, 255, 0.6),
        0 8px 25px rgba(0, 0, 0, 0.3);
    }
    .arl-btn-stop:hover {
      box-shadow:
        0 0 25px rgba(255, 71, 87, 0.6),
        0 8px 25px rgba(0, 0, 0, 0.3);
    }

    .arl-btn:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }

    .arl-btn-icon {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(0, 212, 255, 0.3);
      color: #00d4ff;
      width: 36px;
      height: 36px;
      border-radius: 10px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      transition: all 0.3s ease;
      backdrop-filter: blur(10px);
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    }
    .arl-btn-icon:hover {
      background: linear-gradient(135deg, #00d4ff, #0066ff);
      color: white;
      border-color: rgba(255, 255, 255, 0.3);
      transform: translateY(-1px);
      box-shadow:
        0 0 20px rgba(0, 212, 255, 0.5),
        0 4px 15px rgba(0, 0, 0, 0.3);
    }

    .arl-subscription-status {
      background: rgba(0, 212, 255, 0.05);
      border: 1px solid rgba(0, 212, 255, 0.2);
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 16px;
      font-size: 12px;
    }

    .arl-sub-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
    }

    .arl-sub-info:last-child {
      margin-bottom: 0;
    }

    .arl-sub-label {
      color: var(--arl-text-muted);
      font-weight: 500;
    }

    .arl-sub-value {
      color: var(--arl-text);
      font-weight: 600;
    }

    .arl-sub-value.active {
      color: var(--arl-success);
    }

    .arl-sub-value.warning {
      color: #ffa726;
    }

    .arl-sub-value.error {
      color: var(--arl-danger);
    }

    .arl-sub-plan {
      color: var(--arl-primary);
      font-weight: 600;
      font-size: 14px;
    }

    .arl-manage-sub-btn {
      width: 100%;
      padding: 10px 16px;
      background: linear-gradient(135deg, var(--arl-primary) 0%, #0056d3 100%);
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      margin-top: 8px;
    }

    .arl-manage-sub-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
    }

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

    .arl-setting-disabled {
      opacity: 0.5;
      pointer-events: none;
    }

    .arl-coming-soon {
      background: linear-gradient(135deg, #ff6b6b, #ffa726);
      color: white;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 8px;
      margin-left: 8px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      box-shadow: 0 2px 8px rgba(255, 107, 107, 0.3);
    }

    .arl-toggle-disabled .arl-toggle-slider {
      background-color: #333 !important;
      cursor: not-allowed !important;
    }

    .arl-toggle-disabled .arl-toggle-slider:before {
      background-color: #666 !important;
    }

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

    .arl-profit-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 6px;
      border-radius: 6px;
      margin-top: 4px;
      text-align: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
      display: inline-block;
    }
    .arl-profit-badge.profit {
      color: #3fb950;
      background-color: rgba(63, 185, 80, 0.15);
    }
     .arl-profit-badge.loss {
      color: #f85149;
      background-color: rgba(248, 81, 73, 0.15);
    }

    .arl-inline-fast-book-btn {
      background: none;
      border: none;
      padding: 0;
      margin: 0 12px;

      display: flex !important;
      align-items: center;
      justify-content: center;
      align-self: center;
      flex-shrink: 0;

      padding: 8px 16px !important;
      background-color: var(--arl-primary) !important;
      color: white !important;
      border-radius: 30px !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      white-space: nowrap;
      cursor: pointer !important;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2) !important;
      transition: transform 0.2s ease, background-color 0.2s ease !important;
    }
    .arl-inline-fast-book-btn:hover {
        background-color: var(--arl-success) !important;
        transform: scale(1.1) !important;
    }

    @media (min-width: 1024px) {
      .arl-inline-fast-book-btn {
        padding: 6px 6px !important;
        font-size: 12px !important;
      }
    }

    #arl-priority-lane {
      display: none;
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

  async function waitAndInjectPanel() {
    log('waitAndInjectPanel', 'Starting panel injection...');
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      log('waitAndInjectPanel', `Attempt ${attempts}/30`);
      const searchPanel = ElementFinder.findSearchPanel();
      log('waitAndInjectPanel', `Search panel found: ${!!searchPanel}`, searchPanel?.className);
      if (searchPanel) {
        const isPaid = await checkPaymentStatus();
        log('waitAndInjectPanel', `isPaid: ${isPaid}`);

        if (isPaid) {
          if (!document.getElementById("arl-styles")) {
            const styleSheet = document.createElement("style");
            styleSheet.id = "arl-styles";
            styleSheet.innerText = styles;
            document.head.appendChild(styleSheet);
          }

          const loadListContainer = ElementFinder.findLoadList();
          if (
            loadListContainer &&
            !document.getElementById("arl-priority-lane")
          ) {
            const priorityLaneHTML = `
              <div id="arl-priority-lane">
                <h3 class="arl-priority-header">Newly Detected</h3>
              </div>
            `;
            loadListContainer.insertAdjacentHTML(
              "beforebegin",
              priorityLaneHTML
            );
          }

          if (
            !document.getElementById("amazon-relay-detector-panel") &&
            !document.getElementById("amazon-relay-detector-payment-panel")
          ) {
            searchPanel.insertAdjacentHTML("afterend", controlPanelHTML);
            applySettingsToUI();
            attachListeners();
            setTimeout(() => {
              if (!isDetectionActive) {
                showProfitCalculation();
              }
            }, 500);
          }
        } else {
          const { paymentHTML, paymentStyles } = setupPaymentUI();

          if (!document.getElementById("arl-payment-styles")) {
            const styleSheet = document.createElement("style");
            styleSheet.id = "arl-payment-styles";
            styleSheet.innerText = paymentStyles;
            document.head.appendChild(styleSheet);
          }

          if (
            !document.getElementById("amazon-relay-detector-payment-panel") &&
            !document.getElementById("amazon-relay-detector-panel")
          ) {
            searchPanel.insertAdjacentHTML("afterend", paymentHTML);
            attachPaymentListeners();
          }
        }
        clearInterval(interval);
        startPanelWatchdog();
      }
      if (attempts > 30) {
        clearInterval(interval);
        log('waitAndInjectPanel', 'FAILED - All 30 attempts exhausted, showing warning');
        ElementFinder.showWarning('searchPanel', 'Extension panel');
      }
    }, 300);
  }

  function startPanelWatchdog() {
    if (panelWatchdog) {
      clearInterval(panelWatchdog);
    }

    panelWatchdog = setInterval(async () => {
      const normalPanel = document.getElementById(
        "amazon-relay-detector-panel"
      );
      const paymentPanel = document.getElementById(
        "amazon-relay-detector-payment-panel"
      );

      if (!normalPanel && !paymentPanel) {
        const searchPanel = ElementFinder.findSearchPanel();
        if (searchPanel) {
          const isPaid = await checkPaymentStatus();

          if (isPaid) {
            searchPanel.insertAdjacentHTML("afterend", controlPanelHTML);
            applySettingsToUI();
            attachListeners();

            const loadListContainer = ElementFinder.findLoadList();
            if (
              loadListContainer &&
              !document.getElementById("arl-priority-lane")
            ) {
              const priorityLaneHTML = `
                <div id="arl-priority-lane">
                  <h3 class="arl-priority-header">Newly Detected</h3>
                </div>
              `;
              loadListContainer.insertAdjacentHTML(
                "beforebegin",
                priorityLaneHTML
              );
            }

            setTimeout(() => {
              if (!isDetectionActive) {
                showProfitCalculation();
              }
            }, 100);
          } else {
            const { paymentHTML, paymentStyles } = setupPaymentUI();

            if (!document.getElementById("arl-payment-styles")) {
              const styleSheet = document.createElement("style");
              styleSheet.id = "arl-payment-styles";
              styleSheet.innerText = paymentStyles;
              document.head.appendChild(styleSheet);
            }

            searchPanel.insertAdjacentHTML("afterend", paymentHTML);
            attachPaymentListeners();
          }
        }
      }
    }, 1500);
  }

  function applySettingsToUI() {
    currentSettings = loadSettings();

    baseDelay = currentSettings.baseDelay;
    randomDelay = currentSettings.randomDelay;

    const baseSpeedSlider = document.getElementById("arl-base-speed");
    const randomizerSlider = document.getElementById("arl-randomizer");

    if (baseSpeedSlider) {
      baseSpeedSlider.setAttribute("min", "300");
      baseSpeedSlider.setAttribute("max", "2000");
      baseSpeedSlider.value = baseDelay;
    }
    document.getElementById(
      "arl-base-speed-value"
    ).textContent = `${baseDelay}ms`;

    if (randomizerSlider) {
      randomizerSlider.setAttribute("min", "0");
      randomizerSlider.setAttribute("max", "2000");
      randomizerSlider.value = randomDelay;
    }
    document.getElementById(
      "arl-randomizer-value"
    ).textContent = `${randomDelay}ms`;

    document.getElementById("arl-min-price-increase").value =
      currentSettings.minPriceIncrease;
    document.getElementById("arl-autobooker-toggle").checked =
      currentSettings.autobooker;
    document.getElementById("arl-fastbook-toggle").checked =
      currentSettings.fastBook;

    document.getElementById("arl-profit-toggle").checked =
      currentSettings.showProfitCalculator;
    document.getElementById("arl-mpg-input").value = currentSettings.truckMPG;
    document.getElementById("arl-fuel-price-input").value =
      currentSettings.fuelPrice;

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

    const minPriceInput = document.getElementById("arl-min-price-increase");
    const fastbookToggle = document.getElementById("arl-fastbook-toggle");

    const profitToggle = document.getElementById("arl-profit-toggle");
    const mpgInput = document.getElementById("arl-mpg-input");
    const fuelPriceInput = document.getElementById("arl-fuel-price-input");
    const blacklistInput = document.getElementById("arl-blacklist-input");

    stopBtn.disabled = true;

    speedInput.addEventListener("input", () => {
      if (!isPaidUser) return;
      baseDelay = parseInt(speedInput.value, 10);
      speedValue.textContent = `${baseDelay}ms`;
      currentSettings.baseDelay = baseDelay;
      saveSettings(currentSettings);
    });

    randomInput.addEventListener("input", () => {
      if (!isPaidUser) return;
      randomDelay = parseInt(randomInput.value, 10);
      randomValue.textContent = `${randomDelay}ms`;
      currentSettings.randomDelay = randomDelay;
      saveSettings(currentSettings);
    });

    startBtn.addEventListener("click", () => {
      if (!isPaidUser) {
        return;
      }
      if (isDetectionActive) return;
      isDetectionActive = true;
      statusText.textContent = "Monitoring";
      statusIndicator.style.backgroundColor = "var(--arl-success)";
      startBtn.disabled = true;
      stopBtn.disabled = false;
      hideProfitCalculation();
      startMonitoring();
    });

    stopBtn.addEventListener("click", () => {
      if (!isPaidUser) {
        return;
      }
      stopMonitoring("Stopped ");
      showProfitCalculation();
    });

    settingsBtn.addEventListener("click", async () => {
      const isHidden = settingsPanel.style.display === "none";
      settingsPanel.style.display = isHidden ? "block" : "none";

      if (isHidden && isPaidUser) {
        const mockUser = {
          paid: true,
          subscriptionStatus: "active",
          paidAt: new Date().toISOString(),
          subscriptionCancelAt: null,
        };
        updateSubscriptionDisplay(mockUser);
      }
    });

    minPriceInput.addEventListener("input", () => {
      if (!isPaidUser) return;
      const value = parseFloat(minPriceInput.value);
      if (!isNaN(value)) {
        currentSettings.minPriceIncrease = value;
        saveSettings(currentSettings);
      }
    });

    fastbookToggle.addEventListener("change", () => {
      if (!isPaidUser) return;
      currentSettings.fastBook = fastbookToggle.checked;
      saveSettings(currentSettings);
    });

    profitToggle.addEventListener("change", () => {
      if (!isPaidUser) return;
      currentSettings.showProfitCalculator = profitToggle.checked;
      saveSettings(currentSettings);
      if (!isDetectionActive) {
        if (currentSettings.showProfitCalculator) {
          showProfitCalculation();
        } else {
          hideProfitCalculation();
        }
      }
    });

    mpgInput.addEventListener("input", () => {
      if (!isPaidUser) return;
      const value = parseFloat(mpgInput.value);
      if (!isNaN(value)) {
        currentSettings.truckMPG = value;
        saveSettings(currentSettings);
        if (!isDetectionActive && currentSettings.showProfitCalculator) {
          showProfitCalculation();
        }
      }
    });

    fuelPriceInput.addEventListener("input", () => {
      if (!isPaidUser) return;
      const value = parseFloat(fuelPriceInput.value);
      if (!isNaN(value)) {
        currentSettings.fuelPrice = value;
        saveSettings(currentSettings);
        if (!isDetectionActive && currentSettings.showProfitCalculator) {
          showProfitCalculation();
        }
      }
    });

    blacklistInput.addEventListener("input", () => {
      if (!isPaidUser) return;
      const keywords = blacklistInput.value
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
      currentSettings.blacklist = keywords;
      saveSettings(currentSettings);
    });

    const manageSubBtn = document.getElementById("arl-manage-subscription-btn");
    if (manageSubBtn) {
      manageSubBtn.addEventListener("click", () => {
        if (!isPaidUser) return;
        try {
          extpay.openPaymentPage();
        } catch (error) {
          alert("Unable to open subscription management. Please try again.");
        }
      });
    }
  }

  function attachPaymentListeners() {
    const upgradeBtn = document.getElementById("arl-upgrade-btn");
    if (upgradeBtn) {
      upgradeBtn.addEventListener("click", () => {
        try {
          extpay.openPaymentPage();
        } catch (error) {
          alert(
            "Unable to open payment page. Please try again or contact support."
          );
        }
      });
    }
  }

  waitAndInjectPanel();

  window.addEventListener("beforeunload", () => {
    if (panelWatchdog) {
      clearInterval(panelWatchdog);
    }
  });
}

// ExtPay Payment Callback
try {
  extpay.onPaid.addListener((user) => {
    isPaidUser = true;

    const paymentPanel = document.getElementById(
      "amazon-relay-detector-payment-panel"
    );
    if (paymentPanel) {
      paymentPanel.remove();
    }

    setTimeout(() => {
      location.reload();
    }, 1000);
  });
} catch (error) {}

setupUI();

function showProfitCalculation() {
  log('showProfitCalculation', 'Starting...');
  if (!isPaidUser) {
    log('showProfitCalculation', 'Skipped - not paid user');
    return;
  }
  if (!currentSettings.showProfitCalculator) {
    log('showProfitCalculation', 'Skipped - profit calculator disabled');
    return;
  }

  // Use ElementFinder to get load cards (excludes Similar matches)
  const currentCards = ElementFinder.findLoadCards();
  log('showProfitCalculation', `Found ${currentCards.length} cards`);

  currentCards.forEach((card) => {
    const details = ElementFinder.getCardDetails(card);
    if (!details.id) return;

    const oldProfitBadge = card.querySelector(".arl-profit-badge");
    if (oldProfitBadge) oldProfitBadge.remove();

    const payout = parsePrice(details.price);
    const tripMiles = parsePrice(details.miles);
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

      // Use ElementFinder to find the price container (works on all layouts)
      const targetContainer = ElementFinder.findPriceContainer(card);
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

  showProfitCalculation();
}

function parsePrice(priceString) {
  if (!priceString) return null;
  const cleanedString = priceString.replace(/[^0-9.]/g, "");
  return parseFloat(cleanedString);
}

function startMonitoring() {
  log('startMonitoring', 'Starting monitoring...');
  if (!isPaidUser) {
    log('startMonitoring', 'Skipped - not paid user');
    return;
  }

  const seenLoadDetails = new Map();

  // Use ElementFinder to get initial load cards
  const allCards = ElementFinder.findLoadCards();
  log('startMonitoring', `Initial cards found: ${allCards.length}`);

  allCards.forEach((card) => {
    const details = ElementFinder.getCardDetails(card);
    if (details.id) {
      seenLoadDetails.set(details.id, details.price);
    }
  });
  log('startMonitoring', `Tracking ${seenLoadDetails.size} loads`);

  function detectionCycle() {
    if (!isDetectionActive) {
      log('detectionCycle', 'Stopped - detection not active');
      return;
    }

    log('detectionCycle', 'Clicking refresh button...');
    clickRefreshButton();

    detectionTimeout = setTimeout(() => {
      const searchRoot = document.getElementById("active-tab-body");
      if (!searchRoot) {
        const totalDelay = baseDelay + Math.floor(Math.random() * randomDelay);
        detectionTimeout = setTimeout(detectionCycle, totalDelay);
        return;
      }

      const minPriceIncrease = currentSettings.minPriceIncrease || 5;

      // Use ElementFinder to get current load cards (excludes Similar matches)
      const currentCards = ElementFinder.findLoadCards();

      const newOrUpdatedLoads = [];
      const currentLoadDetails = new Map();

      currentCards.forEach((card) => {
        const details = ElementFinder.getCardDetails(card);
        if (!details.id) return;

        currentLoadDetails.set(details.id, details.price);

        const storedPrice = seenLoadDetails.get(details.id);

        if (!seenLoadDetails.has(details.id) && !globallySeenNewLoads.has(details.id)) {
          const originUpper = details.origin.toUpperCase();
          const destUpper = details.destination.toUpperCase();

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
            newOrUpdatedLoads.push({ id: details.id, card, type: "new" });
          }
        } else if (details.price && storedPrice !== details.price) {
          const oldPriceNum = parsePrice(storedPrice);
          const newPriceNum = parsePrice(details.price);

          if (oldPriceNum !== null && newPriceNum !== null) {
            const difference = newPriceNum - oldPriceNum;

            if (difference >= minPriceIncrease) {
              newOrUpdatedLoads.push({
                id: details.id,
                card,
                type: "price_update",
                oldPrice: storedPrice,
                newPrice: details.price,
                difference: difference,
              });
            }
          }
        }
      });

      if (newOrUpdatedLoads.length > 0) {
        playSound();

        const priorityLane = document.getElementById("arl-priority-lane");
        if (priorityLane) priorityLane.style.display = "block";

        for (const load of newOrUpdatedLoads) {
          load.card.classList.remove(
            "new-load-highlight",
            "price-update-highlight"
          );

          // Remove ALL existing badges (ours and Amazon's) to prevent duplicates
          const existingBadges = load.card.querySelectorAll(
            ".new-load-badge, .price-update-badge, .wo-tag"
          );
          existingBadges.forEach(badge => badge.remove());

          const badge = document.createElement("div");

          if (load.type === "new") {
            // Add to seen loads with memory limit
            if (globallySeenNewLoads.size >= MAX_SEEN_LOADS) {
              const firstKey = globallySeenNewLoads.values().next().value;
              globallySeenNewLoads.delete(firstKey);
            }
            globallySeenNewLoads.add(load.id);

            load.card.classList.add("new-load-highlight");
            badge.className = "new-load-badge";
            badge.textContent = "New";

            if (currentSettings.fastBook) {
              const fastBookBtn = document.createElement("button");
              fastBookBtn.className = "arl-inline-fast-book-btn";
              fastBookBtn.textContent = "Fast Book";
              fastBookBtn.addEventListener("click", (e) => {
                e.stopPropagation();

                const clickableElement = load.card.firstElementChild;
                if (clickableElement) {
                  clickableElement.click();
                  waitForAndClickBookButton();
                } else {
                  load.card.click();
                }
              });

              // Use ElementFinder to find the price column for injection
              const priceColumnInfo = ElementFinder.findPriceColumn(load.card);
              if (priceColumnInfo) {
                if (priceColumnInfo.layout === 'desktop' || priceColumnInfo.layout === 'unknown') {
                  // Desktop: Insert before the price column
                  priceColumnInfo.parentForInjection.insertBefore(
                    fastBookBtn,
                    priceColumnInfo.container
                  );
                } else {
                  // Mobile: Prepend to the container
                  priceColumnInfo.container.prepend(fastBookBtn);
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

          if (priorityLane) {
            priorityLane.prepend(load.card);
          } else {
            load.card.parentElement?.prepend(load.card);
          }
        }
        stopMonitoring("Changes detected");
      } else {
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
  const maxAttempts = 50;
  const interval = setInterval(() => {
    const bookButton = document.querySelector("button#rlb-book-btn");

    if (bookButton) {
      bookButton.click();
      clearInterval(interval);
      waitForAndClickConfirmButton();
      return;
    }

    attempts++;
    if (attempts > maxAttempts) {
      clearInterval(interval);
    }
  }, 100);
}

function waitForAndClickConfirmButton() {
  let attempts = 0;
  const maxAttempts = 50;
  const interval = setInterval(() => {
    const confirmButton = document.querySelector(
      "button#rlb-book-trip-confirm-booking-btn"
    );

    if (confirmButton) {
      confirmButton.click();
      clearInterval(interval);
      return;
    }

    attempts++;
    if (attempts > maxAttempts) {
      clearInterval(interval);
    }
  }, 100);
}

function playSound() {
  const audio = new Audio(chrome.runtime.getURL("cash.mp3"));
  audio.play().catch((e) => {});
}
