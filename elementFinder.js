/**
 * ElementFinder - Bulletproof Element Finding for Amazon Relay
 * Uses multi-strategy fallback approach to handle DOM changes across devices
 */

const ElementFinder = {
  // Track shown warnings to avoid spamming
  _shownWarnings: new Set(),

  // Enable/disable debug logging
  DEBUG: true,

  /**
   * Log debug messages
   */
  log(method, message, data = null) {
    if (!this.DEBUG) return;
    const prefix = `[ElementFinder:${method}]`;
    if (data) {
      console.log(prefix, message, data);
    } else {
      console.log(prefix, message);
    }
  },

  /**
   * Show a warning toast when an element can't be found
   */
  showWarning(elementType, feature) {
    if (this._shownWarnings.has(elementType)) return;
    this._shownWarnings.add(elementType);

    console.warn(`[ElementFinder] WARNING: ${elementType} not found - ${feature}`);

    let toast = document.getElementById('arl-warning-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'arl-warning-toast';
      toast.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; z-index: 999999;
        background: #ff6b35; color: white; padding: 12px 20px;
        border-radius: 8px; font-family: system-ui; font-size: 14px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3); max-width: 350px;
      `;
      document.body.appendChild(toast);
    }

    toast.innerHTML = `
      <strong>Smart Relay Refresher</strong><br>
      ${feature} may not work - Amazon may have updated their site.<br>
      <small>Please report this issue.</small>
      <button onclick="this.parentElement.remove()" style="
        float: right; background: none; border: none; color: white;
        font-size: 18px; cursor: pointer; margin-top: -20px;
      ">&times;</button>
    `;

    setTimeout(() => toast?.remove(), 10000);
  },

  /**
   * Find the refresh button using multiple strategies
   */
  findRefreshButton() {
    this.log('findRefreshButton', 'Starting search...');

    // Strategy 1: Button with mdn-popover-offset containing refresh SVG
    const buttons = document.querySelectorAll('button[mdn-popover-offset]');
    this.log('findRefreshButton', `Strategy 1: Found ${buttons.length} buttons with mdn-popover-offset`);
    for (const btn of buttons) {
      const svg = btn.querySelector('svg');
      const path = btn.querySelector('svg path');
      if (svg && path) {
        const d = path.getAttribute('d') || '';
        this.log('findRefreshButton', `Strategy 1: Checking path d="${d.substring(0, 50)}..."`);
        // Check for circular arrow pattern in the path
        if (d.includes('M20.128 2') || d.includes('9 9 0 10') || d.includes('9 9 0 1 0')) {
          this.log('findRefreshButton', 'Strategy 1: FOUND refresh button via path pattern');
          return btn;
        }
      }
    }

    // Strategy 2: Find icon-only button near search results summary
    const summary = document.querySelector('#search-results-summary-panel, .search-results-summary__panel');
    this.log('findRefreshButton', `Strategy 2: Summary panel found: ${!!summary}`);
    if (summary?.parentElement) {
      const nearbyButtons = summary.parentElement.querySelectorAll('button');
      this.log('findRefreshButton', `Strategy 2: Found ${nearbyButtons.length} nearby buttons`);
      for (const btn of nearbyButtons) {
        if (btn.querySelector('svg') && !btn.textContent.trim()) {
          this.log('findRefreshButton', 'Strategy 2: FOUND refresh button via summary proximity');
          return btn;
        }
      }
    }

    // Strategy 3: Look for button with specific popover offset values
    const offsetBtn = document.querySelector('button[mdn-popover-offset="-8"]');
    this.log('findRefreshButton', `Strategy 3: Button with offset=-8 found: ${!!offsetBtn}`);
    if (offsetBtn && offsetBtn.querySelector('svg')) {
      this.log('findRefreshButton', 'Strategy 3: FOUND refresh button via offset=-8');
      return offsetBtn;
    }

    // Strategy 4: Find any button with a circular arrow SVG (broader search)
    const allButtons = document.querySelectorAll('button');
    this.log('findRefreshButton', `Strategy 4: Checking ${allButtons.length} total buttons`);
    for (const btn of allButtons) {
      const path = btn.querySelector('svg path');
      if (path) {
        const d = path.getAttribute('d') || '';
        // Look for arc patterns typical in refresh icons
        if ((d.includes('A') && d.includes('M') && d.length > 50 && d.length < 200) ||
            d.includes('rotate') || d.includes('9 9 0')) {
          // Verify it's an icon-only button (no visible text)
          if (!btn.textContent.trim() || btn.querySelector('svg')) {
            this.log('findRefreshButton', 'Strategy 4: FOUND refresh button via arc pattern');
            return btn;
          }
        }
      }
    }

    this.log('findRefreshButton', 'FAILED - No refresh button found with any strategy');
    // Don't show warning here - let the caller decide (after retries exhausted)
    return null;
  },

  /**
   * Find the search panel for UI injection
   */
  findSearchPanel() {
    this.log('findSearchPanel', 'Starting search...');

    // Strategy 1: Semantic class (most stable)
    let panel = document.querySelector('.search__panel');
    this.log('findSearchPanel', `Strategy 1: .search__panel found: ${!!panel}`);
    if (panel) {
      this.log('findSearchPanel', 'Strategy 1: FOUND via .search__panel');
      return panel;
    }

    // Strategy 2: ID-based search
    panel = document.querySelector('#search-results-summary-panel');
    this.log('findSearchPanel', `Strategy 2: #search-results-summary-panel found: ${!!panel}`);
    if (panel) {
      const result = panel?.closest('.search__panel') || panel.parentElement;
      this.log('findSearchPanel', `Strategy 2: FOUND via summary panel, returning: ${result?.className || result?.tagName}`);
      return result;
    }

    // Strategy 3: Look for panel containing search filters
    const filters = document.querySelector('[data-testid="search-filters"]');
    this.log('findSearchPanel', `Strategy 3: [data-testid="search-filters"] found: ${!!filters}`);
    if (filters) {
      const result = filters.closest('.search__panel') || filters.parentElement;
      this.log('findSearchPanel', `Strategy 3: FOUND via filters, returning: ${result?.className || result?.tagName}`);
      return result;
    }

    // Strategy 4: Look for common Amazon Relay panel structures
    const possiblePanels = document.querySelectorAll('[class*="search"], [class*="panel"], [class*="filter"]');
    this.log('findSearchPanel', `Strategy 4: Found ${possiblePanels.length} possible panels`);
    for (const p of possiblePanels) {
      this.log('findSearchPanel', `Strategy 4: Checking element with class: ${p.className}`);
    }

    this.log('findSearchPanel', 'FAILED - No search panel found');
    // Don't show warning here - let the caller decide (after retries exhausted)
    return null;
  },

  /**
   * Find the load list container
   */
  findLoadList() {
    this.log('findLoadList', 'Starting search...');

    // Strategy 1: Role-based (stable)
    let list = document.querySelector('[role="list"]');
    this.log('findLoadList', `Strategy 1: [role="list"] found: ${!!list}`);
    if (list) {
      this.log('findLoadList', 'Strategy 1: FOUND via role="list"');
      return list;
    }

    // Strategy 2: Class-based
    list = document.querySelector('.load-list');
    this.log('findLoadList', `Strategy 2: .load-list found: ${!!list}`);
    if (list) {
      this.log('findLoadList', 'Strategy 2: FOUND via .load-list');
      return list;
    }

    // Strategy 3: Container of load cards
    const firstCard = document.querySelector('.load-card');
    this.log('findLoadList', `Strategy 3: .load-card found: ${!!firstCard}`);
    if (firstCard) {
      this.log('findLoadList', 'Strategy 3: FOUND via .load-card parent');
      return firstCard.parentElement;
    }

    this.log('findLoadList', 'FAILED - No load list found');
    return null;
  },

  /**
   * Find all load cards, excluding "Similar matches" section
   */
  findLoadCards() {
    this.log('findLoadCards', 'Starting search...');

    const searchRoot = document.getElementById('active-tab-body');
    this.log('findLoadCards', `#active-tab-body found: ${!!searchRoot}`);
    if (!searchRoot) {
      this.log('findLoadCards', 'FAILED - No active-tab-body found');
      return [];
    }

    // Get all potential load cards
    const allMatches = Array.from(
      searchRoot.querySelectorAll('.load-card, .wo-card-header--highlighted, div[id]:has(.wo-total_payout)')
    );
    this.log('findLoadCards', `Found ${allMatches.length} total matches before deduplication`);

    // Deduplicate: filter out elements that are children of other matched elements
    // This prevents counting nested matches as separate cards
    const uniqueCards = allMatches.filter(card => {
      // Check if any other matched element is an ancestor of this one
      const isNestedInAnotherMatch = allMatches.some(otherCard =>
        otherCard !== card && otherCard.contains(card)
      );
      return !isNestedInAnotherMatch;
    });
    this.log('findLoadCards', `After deduplication: ${uniqueCards.length} unique cards`);

    // Filter out cards in the "Similar matches" section
    const filteredCards = uniqueCards.filter(card => !this.isInSimilarMatchesSection(card));
    this.log('findLoadCards', `After filtering Similar matches: ${filteredCards.length} cards`);

    return filteredCards;
  },

  /**
   * Check if a card is inside the "Similar matches" section
   */
  isInSimilarMatchesSection(card) {
    // Walk up the DOM to check for "Similar matches" header
    let element = card;
    while (element && element !== document.body) {
      // Check previous siblings for the "Similar matches" text
      let sibling = element.previousElementSibling;
      while (sibling) {
        // Check if this sibling is the "Similar matches" header
        if (sibling.tagName === 'P' && sibling.textContent.trim() === 'Similar matches') {
          return true;
        }
        // Check children of sibling for the text
        const textElements = sibling.querySelectorAll('p, span, div, h1, h2, h3, h4, h5, h6');
        for (const el of textElements) {
          if (el.textContent.trim() === 'Similar matches') {
            return true;
          }
        }
        sibling = sibling.previousElementSibling;
      }
      element = element.parentElement;
    }

    // Alternative check: look for "Similar matches" text anywhere above this card
    const cardRect = card.getBoundingClientRect();
    const allTextElements = document.querySelectorAll('p, span');
    for (const el of allTextElements) {
      if (el.textContent.trim() === 'Similar matches') {
        const elRect = el.getBoundingClientRect();
        // If "Similar matches" text is above this card and card is below it
        if (elRect.bottom < cardRect.top && Math.abs(elRect.left - cardRect.left) < 100) {
          // Check if they're in the same container context
          const commonParent = this._findCommonParent(el, card);
          if (commonParent && commonParent.contains(card)) {
            return true;
          }
        }
      }
    }

    return false;
  },

  /**
   * Find common parent of two elements
   */
  _findCommonParent(el1, el2) {
    const parents1 = [];
    let parent = el1;
    while (parent) {
      parents1.push(parent);
      parent = parent.parentElement;
    }

    parent = el2;
    while (parent) {
      if (parents1.includes(parent)) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return null;
  },

  /**
   * Find the price element within a card
   */
  findPriceElement(card) {
    if (!card) {
      this.log('findPriceElement', 'No card provided');
      return null;
    }

    // Strategy 1: Semantic class (most stable)
    let price = card.querySelector('.wo-total_payout');
    if (price) {
      this.log('findPriceElement', `Strategy 1: FOUND via .wo-total_payout: ${price.textContent.trim()}`);
      return price;
    }

    // Strategy 2: Modified price class
    price = card.querySelector('.wo-total_payout__modified-load-increase-attr');
    if (price) {
      this.log('findPriceElement', `Strategy 2: FOUND via modified class: ${price.textContent.trim()}`);
      return price;
    }

    // Strategy 3: Find span with $ pattern
    const spans = card.querySelectorAll('span');
    for (const span of spans) {
      const text = span.textContent.trim();
      if (/^\$[\d,]+\.?\d*$/.test(text)) {
        this.log('findPriceElement', `Strategy 3: FOUND via $ pattern: ${text}`);
        return span;
      }
    }

    this.log('findPriceElement', 'FAILED - No price element found');
    return null;
  },

  /**
   * Find the miles element within a card (excluding deadhead)
   */
  findMilesElement(card) {
    if (!card) return null;

    const allSpans = Array.from(card.querySelectorAll('span'));
    const deadheadElement = card.querySelector('[title="Deadhead"]');

    for (const span of allSpans) {
      const text = span.textContent.trim();
      // Must contain " mi" but not "/mi" (which is rate)
      if (text.includes(' mi') && !text.includes('/mi')) {
        // Must not be inside deadhead element
        if (deadheadElement && deadheadElement.contains(span)) continue;
        if (span.closest('[title="Deadhead"]')) continue;
        return span;
      }
    }

    return null;
  },

  /**
   * Find origin and destination location elements
   */
  findLocations(card) {
    if (!card) return { origin: null, destination: null };

    // Strategy 1: Semantic class (most stable)
    const locationSpans = card.querySelectorAll('.wo-card-header__components');
    if (locationSpans.length >= 2) {
      return {
        origin: locationSpans[0],
        destination: locationSpans[1]
      };
    }

    // Strategy 2: mdn-text attribute
    const mdnTextElements = card.querySelectorAll('[mdn-text]');
    if (mdnTextElements.length >= 2) {
      return {
        origin: mdnTextElements[0],
        destination: mdnTextElements[1]
      };
    }

    return { origin: locationSpans[0] || null, destination: locationSpans[1] || null };
  },

  /**
   * Find the price container for badge injection
   * This is the key discovery - .css-1dk3tf8 is stable across ALL layouts!
   */
  findPriceContainer(card) {
    if (!card) {
      this.log('findPriceContainer', 'No card provided');
      return null;
    }

    // Strategy 1: The stable price wrapper class (works on desktop AND mobile!)
    let container = card.querySelector('.css-1dk3tf8');
    if (container) {
      this.log('findPriceContainer', 'Strategy 1: FOUND via .css-1dk3tf8');
      return container;
    }
    this.log('findPriceContainer', 'Strategy 1: .css-1dk3tf8 NOT found');

    // Strategy 2: Traverse up from price element
    const price = this.findPriceElement(card);
    if (price) {
      this.log('findPriceContainer', 'Strategy 2: Traversing up from price element');
      // Go up to find a suitable container
      let parent = price.parentElement;
      while (parent && parent !== card) {
        // Look for a div that contains the price and has limited children
        if (parent.tagName === 'DIV' && parent.children.length <= 5) {
          this.log('findPriceContainer', `Strategy 2: FOUND parent div with ${parent.children.length} children`);
          return parent;
        }
        parent = parent.parentElement;
      }
    }

    // Strategy 3: Find container with $ text pattern
    const divs = card.querySelectorAll('div');
    this.log('findPriceContainer', `Strategy 3: Checking ${divs.length} divs for price container`);
    for (const div of divs) {
      if (div.querySelector('.wo-total_payout') && div.children.length <= 5) {
        this.log('findPriceContainer', 'Strategy 3: FOUND div containing .wo-total_payout');
        return div;
      }
    }

    this.log('findPriceContainer', 'FAILED - No price container found');
    return null;
  },

  /**
   * Find the price column for Fast Book button injection
   * Returns { container, layout } where layout is 'desktop' or 'mobile'
   */
  findPriceColumn(card) {
    if (!card) return null;

    // Strategy 1: Desktop layout - look for flex column structure
    // The price column on desktop is typically the last major column
    const priceContainer = this.findPriceContainer(card);
    if (priceContainer) {
      // Walk up to find the column container
      let parent = priceContainer.parentElement;
      while (parent && parent !== card) {
        const style = window.getComputedStyle(parent);
        // Look for flex column or a container that holds price
        if (style.display === 'flex' || parent.querySelector('.wo-total_payout')) {
          // Check if this is a major layout column (has siblings)
          if (parent.parentElement && parent.parentElement.children.length >= 2) {
            return {
              container: parent,
              parentForInjection: parent.parentElement,
              layout: 'desktop'
            };
          }
        }
        parent = parent.parentElement;
      }
    }

    // Strategy 2: Mobile layout - price is in a row with arrow
    const allDivs = Array.from(card.querySelectorAll('div'));
    for (const div of allDivs) {
      if (div.querySelector('.wo-total_payout') && div.querySelector('svg')) {
        return {
          container: div,
          parentForInjection: div,
          layout: 'mobile'
        };
      }
    }

    // Strategy 3: Just return the price container
    if (priceContainer) {
      return {
        container: priceContainer,
        parentForInjection: priceContainer.parentElement || priceContainer,
        layout: 'unknown'
      };
    }

    return null;
  },

  /**
   * Get unique ID from a card element
   */
  getCardId(card) {
    if (!card) return null;

    // Strategy 1: Direct ID on card
    if (card.id && card.id.length > 10) {
      return card.id;
    }

    // Strategy 2: ID on child div (common pattern)
    const idDiv = card.querySelector('div[id]');
    if (idDiv && idDiv.id && idDiv.id.length > 10) {
      return idDiv.id;
    }

    // Strategy 3: Data attribute
    const dataId = card.getAttribute('data-id') || card.getAttribute('data-load-id');
    if (dataId) return dataId;

    return null;
  },

  /**
   * Get all card details using stable selectors
   */
  getCardDetails(card) {
    if (!card) return { id: null, price: null, miles: null, origin: '', destination: '' };

    const id = this.getCardId(card);

    const priceElement = this.findPriceElement(card);
    const price = priceElement ? priceElement.textContent.trim() : null;

    const milesElement = this.findMilesElement(card);
    const miles = milesElement ? milesElement.textContent.trim() : null;

    const locations = this.findLocations(card);
    const origin = locations.origin ? locations.origin.textContent.trim() : '';
    const destination = locations.destination ? locations.destination.textContent.trim() : '';

    return { id, price, miles, origin, destination };
  },

  /**
   * Check if we're on a mobile layout
   */
  isMobileLayout() {
    // Check viewport width
    if (window.innerWidth < 768) return true;

    // Check for mobile-specific classes on load cards
    const card = document.querySelector('.load-card');
    if (card) {
      // Mobile uses different layout structure
      return !card.querySelector('.css-soq2b7');
    }

    return false;
  }
};

// Export for use in content.js
if (typeof window !== 'undefined') {
  window.ElementFinder = ElementFinder;
}
