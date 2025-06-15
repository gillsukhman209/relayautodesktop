console.log("📦 content.js loaded");
console.log("✅ content.js is running");

// ExtPay Integration
const extpay = ExtPay("relay-ai-booker");

let isDetectionActive = false;
let detectionTimeout;
let baseDelay = 800;
let randomDelay = 500;
let globallySeenNewLoads = new Set(); // To prevent re-detecting the same new loads
let isPaidUser = false;
let userPaymentStatus = null;

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

// Payment Status Check Function
async function checkPaymentStatus() {
  try {
    const user = await extpay.getUser();
    isPaidUser = user.paid && user.subscriptionStatus === "active";
    userPaymentStatus = user.subscriptionStatus;
    console.log(
      "💳 Payment Status:",
      isPaidUser ? "PAID" : "UNPAID",
      `(${userPaymentStatus})`
    );

    // Store user data for subscription display in settings
    if (isPaidUser) {
      window.currentUserData = user;
    }

    return isPaidUser;
  } catch (error) {
    console.error("❌ ExtPay Error:", error);
    isPaidUser = false;
    return false;
  }
}

// Update Subscription Status Display
function updateSubscriptionDisplay(user) {
  const statusElement = document.getElementById("arl-sub-status");
  const billingElement = document.getElementById("arl-sub-billing");

  if (!statusElement || !billingElement) return;

  // Update subscription status
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

  // Update next billing date
  if (user.subscriptionCancelAt) {
    const cancelDate = new Date(user.subscriptionCancelAt);
    billingElement.textContent = `Ends ${cancelDate.toLocaleDateString()}`;
    billingElement.className = "arl-sub-value warning";
  } else if (user.subscriptionStatus === "active") {
    // Calculate next billing (ExtPay doesn't provide this directly, so we estimate)
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
        <div class="arl-payment-icon">🚛</div>
        <h2 class="arl-payment-title">Relay AI Booker Pro</h2>
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
      margin-top: 12px;
      z-index: 999999;
      background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
      color: #ffffff;
      border: 1px solid #00d4ff;
      border-radius: 16px;
      padding: 24px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      box-shadow: 
        0 0 30px rgba(0, 212, 255, 0.3),
        0 10px 50px rgba(0, 0, 0, 0.5),
        inset 0 1px 0 rgba(255, 255, 255, 0.1);
      min-width: 300px;
      max-width: 400px;
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
      margin-bottom: 24px;
    }

    .arl-payment-icon {
      font-size: 48px;
      margin-bottom: 12px;
      filter: drop-shadow(0 0 10px rgba(0, 212, 255, 0.5));
    }

    .arl-payment-title {
      font-size: 24px;
      font-weight: 700;
      margin: 0 0 8px 0;
      background: linear-gradient(135deg, #00d4ff, #0066ff);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .arl-payment-subtitle {
      font-size: 14px;
      color: #a0a0a0;
      margin: 0;
    }

    .arl-value-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 24px;
    }

    .arl-value-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 10px;
      border: 1px solid rgba(0, 212, 255, 0.2);
      transition: all 0.3s ease;
    }

    .arl-value-item:hover {
      border-color: rgba(0, 212, 255, 0.5);
      transform: translateY(-2px);
    }

    .arl-value-icon {
      font-size: 20px;
      flex-shrink: 0;
    }

    .arl-value-text h4 {
      margin: 0 0 4px 0;
      font-size: 13px;
      font-weight: 600;
      color: #ffffff;
    }

    .arl-value-text p {
      margin: 0;
      font-size: 11px;
      color: #a0a0a0;
      line-height: 1.3;
    }

    .arl-pricing-section {
      text-align: center;
      margin: 24px 0;
      padding: 20px;
      background: rgba(0, 212, 255, 0.1);
      border-radius: 12px;
      border: 1px solid rgba(0, 212, 255, 0.3);
    }

    .arl-price-tag {
      margin-bottom: 12px;
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
      font-size: 12px;
      color: #a0a0a0;
      font-style: italic;
    }

    .arl-roi-icon {
      font-size: 14px;
    }

    .arl-upgrade-button {
      width: 100%;
      padding: 16px 24px;
      background: linear-gradient(135deg, #00d4ff 0%, #0066ff 100%);
      border: none;
      border-radius: 12px;
      color: #ffffff;
      font-size: 18px;
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
      margin-bottom: 20px;
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
      margin: 4px 0;
      font-size: 12px;
      color: #a0a0a0;
    }

    /* Responsive adjustments */
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
        <span class="arl-title">Relay AI Booker</span>
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

    /* --- Subscription Status --- */
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

  async function waitAndInjectPanel() {
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const searchPanel = document.querySelector(".search__panel");
      if (searchPanel) {
        // Check payment status first
        const isPaid = await checkPaymentStatus();

        if (isPaid) {
          // User is paid - show normal UI
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
            loadListContainer.insertAdjacentHTML(
              "beforebegin",
              priorityLaneHTML
            );
          }

          // Then, inject the panel if it doesn't exist
          if (
            !document.getElementById("amazon-relay-detector-panel") &&
            !document.getElementById("amazon-relay-detector-payment-panel")
          ) {
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
        } else {
          // User is not paid - show payment UI
          const { paymentHTML, paymentStyles } = setupPaymentUI();

          // Inject payment styles if they don't exist
          if (!document.getElementById("arl-payment-styles")) {
            const styleSheet = document.createElement("style");
            styleSheet.id = "arl-payment-styles";
            styleSheet.innerText = paymentStyles;
            document.head.appendChild(styleSheet);
          }

          // Inject payment panel if it doesn't exist
          if (
            !document.getElementById("amazon-relay-detector-payment-panel") &&
            !document.getElementById("amazon-relay-detector-panel")
          ) {
            searchPanel.insertAdjacentHTML("beforeend", paymentHTML);
            attachPaymentListeners();
          }
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
        console.log("🚫 Start blocked - payment required");
        return;
      }
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
      if (!isPaidUser) {
        console.log("🚫 Stop blocked - payment required");
        return;
      }
      stopMonitoring("Stopped ");
      // Show profit calculation when stop button is clicked
      showProfitCalculation();
    });

    settingsBtn.addEventListener("click", async () => {
      const isHidden = settingsPanel.style.display === "none";
      settingsPanel.style.display = isHidden ? "block" : "none";

      // Refresh subscription status when opening settings
      if (isHidden && isPaidUser) {
        const user = await extpay.getUser();
        updateSubscriptionDisplay(user);
      }
    });

    // --- Listeners for saving settings ---
    minPriceInput.addEventListener("input", () => {
      if (!isPaidUser) return;
      const value = parseFloat(minPriceInput.value);
      if (!isNaN(value)) {
        currentSettings.minPriceIncrease = value;
        saveSettings(currentSettings);
      }
    });

    // Autobooker is disabled - coming soon
    // autobookerToggle.addEventListener("change", () => {
    //   if (!isPaidUser) return;
    //   currentSettings.autobooker = autobookerToggle.checked;
    //   saveSettings(currentSettings);
    // });

    fastbookToggle.addEventListener("change", () => {
      if (!isPaidUser) return;
      currentSettings.fastBook = fastbookToggle.checked;
      saveSettings(currentSettings);
    });

    // --- Listeners for Profit Calculator ---
    profitToggle.addEventListener("change", () => {
      if (!isPaidUser) return;
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
      if (!isPaidUser) return;
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
      if (!isPaidUser) return;
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
      if (!isPaidUser) return;
      const keywords = blacklistInput.value
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);
      currentSettings.blacklist = keywords;
      saveSettings(currentSettings);
    });

    // --- Listener for Settings Manage Subscription ---
    const manageSubBtn = document.getElementById("arl-manage-subscription-btn");
    if (manageSubBtn) {
      manageSubBtn.addEventListener("click", () => {
        if (!isPaidUser) return;
        console.log("💳 Opening subscription management from settings...");
        try {
          extpay.openPaymentPage();
        } catch (error) {
          console.error("❌ Subscription management error:", error);
          alert("Unable to open subscription management. Please try again.");
        }
      });
    }
  }

  // Payment UI Event Listeners
  function attachPaymentListeners() {
    const upgradeBtn = document.getElementById("arl-upgrade-btn");
    if (upgradeBtn) {
      upgradeBtn.addEventListener("click", () => {
        console.log("💳 Opening payment page...");
        try {
          extpay.openPaymentPage();
        } catch (error) {
          console.error("❌ Payment page error:", error);
          alert(
            "Unable to open payment page. Please try again or contact support."
          );
        }
      });
    }
  }

  waitAndInjectPanel();
}

// ExtPay Payment Callback
try {
  extpay.onPaid.addListener((user) => {
    console.log("🎉 User paid! Refreshing interface...");
    isPaidUser = true;

    // Remove payment panel and inject normal UI
    const paymentPanel = document.getElementById(
      "amazon-relay-detector-payment-panel"
    );
    if (paymentPanel) {
      paymentPanel.remove();
    }

    // Force refresh the UI to show normal interface
    setTimeout(() => {
      location.reload();
    }, 1000);
  });
} catch (error) {
  console.error("❌ ExtPay onPaid callback error:", error);
}

setupUI();

function showProfitCalculation() {
  if (!isPaidUser) return; // Payment gate
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
  if (!isPaidUser) {
    console.log("🚫 Monitoring blocked - payment required");
    return;
  }
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
