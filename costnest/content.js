// Content Script for CostNest - Product Detection and Price Extraction

// Utility function to check extension context
function validateExtensionContext() {
    try {
        return chrome && chrome.runtime && chrome.runtime.id;
    } catch (error) {
        console.warn('Extension context not available:', error);
        return false;
    }
}

// Safe message sending with context validation
async function safeSendMessage(message) {
    try {
        if (!validateExtensionContext()) {
            throw new Error('Extension context invalidated');
        }
        return await chrome.runtime.sendMessage(message);
    } catch (error) {
        console.error('CostNest: Message sending failed:', error);
        throw error;
    }
}

class ContentScriptManager {
    constructor() {
        this.isInitialized = false;
        this.quickAddOverlay = null;
        this.priceSelectors = [
            // Amazon
            '.a-price-whole',
            '.a-price .a-offscreen',
            '#priceblock_dealprice',
            '#priceblock_ourprice',
            '.a-price-range',
            
            // eBay
            '.u-flL.condText',
            '.notranslate',
            '#prcIsum',
            '.vi-price .notranslate',
            
            // General e-commerce
            '[data-testid="price"]',
            '.price',
            '.product-price',
            '.current-price',
            '.sale-price',
            '.regular-price',
            '.price-current',
            '.price-now',
            '.final-price',
            '.special-price',
            
            // Walmart
            '[data-automation-id="product-price"]',
            '.price-characteristic',
            
            // Target
            '[data-test="product-price"]',
            '.h-display-xs',
            
            // Best Buy
            '.sr-only',
            '.pricing-price__range',
            '[aria-label*="current price"]',
            '[aria-label*="Current price"]',
            
            // Generic patterns
            '*[class*="price"]',
            '*[id*="price"]',
            '*[data-price]'
        ];
        
        this.titleSelectors = [
            'h1',
            '[data-testid="product-title"]',
            '.product-title',
            '.product-name',
            '#productTitle',
            '.pdp-product-name',
            '.item-title',
            '.product-item-name'
        ];
        
        this.init();
    }

    init() {
        if (this.isInitialized) return;
        
        this.setupMessageListener();
        this.detectProductPage();
        this.setupPriceChangeObserver();
        this.isInitialized = true;
        
        console.log('CostNest content script initialized');
    }

    setupMessageListener() {
        try {
            if (!validateExtensionContext()) {
                console.warn('Cannot setup message listener: extension context invalid');
                return;
            }
            
            chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
                try {
                    this.handleMessage(message, sender, sendResponse);
                    return true; // Keep message channel open for async response
                } catch (error) {
                    if (error.message.includes('Extension context invalidated')) {
                        console.log('Extension context invalidated, reloading...');
                        window.location.reload();
                    } else {
                        console.error('Error handling message:', error);
                        sendResponse({ error: error.message });
                    }
                }
            });
        } catch (error) {
            console.error('Failed to setup message listener:', error);
        }
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            switch (message.type) {
                case 'SHOW_QUICK_ADD':
                    this.showQuickAddOverlay(message.data);
                    sendResponse({ success: true });
                    break;
                
                case 'EXTRACT_PRODUCT_INFO':
                    const productInfo = this.extractProductInfo(message.data.url);
                    sendResponse({ productInfo });
                    break;
                
                case 'GET_CURRENT_PRICE':
                    const currentPrice = this.getCurrentPrice();
                    sendResponse({ price: currentPrice });
                    break;
                
                case 'DETECT_RECEIPT':
                    const receiptData = this.detectReceiptData();
                    sendResponse({ receiptData });
                    break;
                
                default:
                    sendResponse({ error: 'Unknown message type' });
            }
        } catch (error) {
            console.error('Content script message handling error:', error);
            sendResponse({ error: error.message });
        }
    }

    detectProductPage() {
        // Check if current page is likely a product page
        const indicators = [
            () => this.getCurrentPrice() !== null,
            () => this.getProductTitle() !== null,
            () => document.querySelector('[data-testid="add-to-cart"], .add-to-cart, #add-to-cart, [id*="add-to-cart"], [class*="add-to-cart"]') !== null,
            () => document.querySelector('.product, .item, [data-testid="product"]') !== null,
            () => /\/(product|item|p)\//.test(window.location.pathname)
        ];
        
        const isProductPage = indicators.filter(check => check()).length >= 1;
        
        // Always add the button for now to ensure functionality
        this.addCostNestButton();
        
        if (isProductPage) {
            this.trackPriceChanges();
        }
    }

    getCurrentPrice() {
        for (const selector of this.priceSelectors) {
            try {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    const priceText = element.textContent || element.innerText || element.getAttribute('data-price');
                    if (priceText) {
                        const price = this.extractPriceFromText(priceText);
                        if (price && price > 0) {
                            return price;
                        }
                    }
                }
            } catch (error) {
                console.warn('Error checking price selector:', selector, error);
            }
        }
        return null;
    }

    extractPriceFromText(text) {
        if (!text) return null;
        
        // Remove common currency symbols and clean text
        const cleanText = text.replace(/[^0-9.,\s]/g, '').trim();
        
        // Match price patterns
        const patterns = [
            /([0-9]{1,3}(?:,?[0-9]{3})*(?:\.[0-9]{2})?)/, // Standard price format
            /([0-9]+\.[0-9]{2})/, // Decimal price
            /([0-9]+)/ // Integer price
        ];
        
        for (const pattern of patterns) {
            const match = cleanText.match(pattern);
            if (match) {
                const price = parseFloat(match[1].replace(/,/g, ''));
                if (price > 0 && price < 1000000) { // Reasonable price range
                    return price;
                }
            }
        }
        
        return null;
    }

    getProductTitle() {
        for (const selector of this.titleSelectors) {
            try {
                const element = document.querySelector(selector);
                if (element) {
                    const title = element.textContent || element.innerText;
                    if (title && title.trim().length > 0) {
                        return title.trim();
                    }
                }
            } catch (error) {
                console.warn('Error checking title selector:', selector, error);
            }
        }
        
        // Fallback to page title
        return document.title || 'Unknown Product';
    }

    extractProductInfo(url = window.location.href) {
        const price = this.getCurrentPrice();
        const title = this.getProductTitle();
        const images = this.getProductImages();
        const description = this.getProductDescription();
        const category = this.guessCategory(title, description);
        
        return {
            url,
            title,
            price,
            images,
            description,
            category,
            domain: window.location.hostname,
            extractedAt: new Date().toISOString()
        };
    }

    getProductImages() {
        const imageSelectors = [
            '[data-testid="product-image"] img',
            '.product-image img',
            '#landingImage',
            '.product-photo img',
            '.item-image img',
            '.main-image img'
        ];
        
        const images = [];
        for (const selector of imageSelectors) {
            const elements = document.querySelectorAll(selector);
            for (const img of elements) {
                if (img.src && !images.includes(img.src)) {
                    images.push(img.src);
                }
            }
        }
        
        return images.slice(0, 3); // Limit to 3 images
    }

    getProductDescription() {
        const descSelectors = [
            '[data-testid="product-description"]',
            '.product-description',
            '#feature-bullets',
            '.product-details',
            '.item-description',
            '.product-info'
        ];
        
        for (const selector of descSelectors) {
            const element = document.querySelector(selector);
            if (element) {
                const text = element.textContent || element.innerText;
                if (text && text.trim().length > 10) {
                    return text.trim().substring(0, 200) + '...';
                }
            }
        }
        
        return '';
    }

    guessCategory(title, description) {
        const text = (title + ' ' + description).toLowerCase();
        
        const categoryKeywords = {
            'food': ['food', 'snack', 'drink', 'coffee', 'tea', 'restaurant', 'meal'],
            'shopping': ['clothing', 'shoes', 'fashion', 'accessories', 'jewelry', 'bag'],
            'entertainment': ['game', 'movie', 'music', 'book', 'toy', 'hobby'],
            'transport': ['car', 'fuel', 'gas', 'parking', 'uber', 'taxi', 'bus'],
            'health': ['medicine', 'vitamin', 'health', 'fitness', 'gym', 'medical'],
            'bills': ['utility', 'phone', 'internet', 'subscription', 'service']
        };
        
        for (const [category, keywords] of Object.entries(categoryKeywords)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                return category;
            }
        }
        
        return 'other';
    }

    addCostNestButton() {
        // Avoid duplicate buttons
        if (document.querySelector('.costnest-add-button')) return;
        
        const button = document.createElement('button');
        button.className = 'costnest-add-button';
        button.innerHTML = `
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"/>
            </svg>
            Add to CostNest
        `;
        
        button.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 25px;
            padding: 12px 20px;
            font-family: 'Bungee', cursive;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.2);
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        
        button.addEventListener('mouseenter', () => {
            button.style.transform = 'translateY(-2px)';
            button.style.boxShadow = '0 12px 40px rgba(102, 126, 234, 0.4)';
        });
        
        button.addEventListener('mouseleave', () => {
            button.style.transform = 'translateY(0)';
            button.style.boxShadow = '0 8px 32px rgba(102, 126, 234, 0.3)';
        });
        
        button.addEventListener('click', () => {
            this.handleAddExpenseClick();
        });
        
        document.body.appendChild(button);
    }

    async handleAddExpenseClick() {
        const productInfo = this.extractProductInfo();
        
        if (!productInfo.price) {
            this.showNotification('Could not detect price on this page', 'error');
            return;
        }
        
        this.showQuickAddOverlay({
            amount: productInfo.price,
            description: productInfo.title,
            url: productInfo.url,
            category: productInfo.category
        });
    }

    showQuickAddOverlay(data) {
        // Remove existing overlay
        if (this.quickAddOverlay) {
            this.quickAddOverlay.remove();
        }
        
        const overlay = document.createElement('div');
        overlay.className = 'costnest-quick-add-overlay';
        overlay.innerHTML = `
            <div class="costnest-quick-add-modal">
                <div class="costnest-modal-header">
                    <h3>Add Expense to CostNest</h3>
                    <button class="costnest-close-btn">&times;</button>
                </div>
                <form class="costnest-quick-add-form">
                    <div class="costnest-form-group">
                        <label>Amount</label>
                        <input type="number" name="amount" value="${data.amount || ''}" step="0.01" required>
                    </div>
                    <div class="costnest-form-group">
                        <label>Description</label>
                        <input type="text" name="description" value="${data.description || ''}" required>
                    </div>
                    <div class="costnest-form-group">
                        <label>Category</label>
                        <select name="category">
                            <option value="food" ${data.category === 'food' ? 'selected' : ''}>Food & Dining</option>
                            <option value="shopping" ${data.category === 'shopping' ? 'selected' : ''}>Shopping</option>
                            <option value="entertainment" ${data.category === 'entertainment' ? 'selected' : ''}>Entertainment</option>
                            <option value="transport" ${data.category === 'transport' ? 'selected' : ''}>Transportation</option>
                            <option value="bills" ${data.category === 'bills' ? 'selected' : ''}>Bills & Utilities</option>
                            <option value="health" ${data.category === 'health' ? 'selected' : ''}>Health & Fitness</option>
                            <option value="other" ${data.category === 'other' ? 'selected' : ''}>Other</option>
                        </select>
                    </div>
                    <div class="costnest-form-actions">
                        <button type="button" class="costnest-cancel-btn">Cancel</button>
                        <button type="submit" class="costnest-add-btn">Add Expense</button>
                    </div>
                </form>
            </div>
        `;
        
        this.addQuickAddStyles(overlay);
        this.setupQuickAddEvents(overlay, data);
        
        document.body.appendChild(overlay);
        this.quickAddOverlay = overlay;
        
        // Focus on amount input
        setTimeout(() => {
            const amountInput = overlay.querySelector('input[name="amount"]');
            if (amountInput) amountInput.focus();
        }, 100);
    }

    addQuickAddStyles(overlay) {
        // Ensure Google Fonts are loaded
        if (!document.querySelector('link[href*="fonts.googleapis.com/css2?family=Bungee"]')) {
            const fontLink = document.createElement('link');
            fontLink.href = 'https://fonts.googleapis.com/css2?family=Bungee:wght@400&display=swap';
            fontLink.rel = 'stylesheet';
            document.head.appendChild(fontLink);
        }
        
        const style = document.createElement('style');
        style.textContent = `
            .costnest-quick-add-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                backdrop-filter: blur(5px);
                z-index: 10001;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: fadeIn 0.3s ease;
            }
            
            .costnest-quick-add-modal {
                background: rgba(255, 255, 255, 0.95);
                backdrop-filter: blur(20px);
                border-radius: 20px;
                padding: 30px;
                width: 90%;
                max-width: 400px;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(255, 255, 255, 0.3);
                animation: slideUp 0.3s ease;
            }
            
            .costnest-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
            }
            
            .costnest-modal-header h3 {
                margin: 0;
                font-family: 'Bungee', cursive;
                font-size: 18px;
                color: #333;
            }
            
            .costnest-close-btn {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #666;
                padding: 0;
                width: 30px;
                height: 30px;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 50%;
                transition: all 0.2s ease;
            }
            
            .costnest-close-btn:hover {
                background: rgba(0, 0, 0, 0.1);
                color: #333;
            }
            
            .costnest-form-group {
                margin-bottom: 20px;
            }
            
            .costnest-form-group label {
                display: block;
                margin-bottom: 8px;
                font-family: 'Bungee', cursive;
                font-weight: 600;
                color: #333;
                font-size: 14px;
            }
            
            .costnest-form-group input,
            .costnest-form-group select {
                width: 100%;
                padding: 12px 16px;
                border: 2px solid rgba(102, 126, 234, 0.2);
                border-radius: 12px;
                font-family: 'Bungee', cursive;
                font-size: 16px;
                background: rgba(255, 255, 255, 0.8);
                transition: all 0.3s ease;
                box-sizing: border-box;
            }
            
            .costnest-form-group input:focus,
            .costnest-form-group select:focus {
                outline: none;
                border-color: #667eea;
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }
            
            .costnest-form-actions {
                display: flex;
                gap: 12px;
                margin-top: 30px;
            }
            
            .costnest-cancel-btn,
            .costnest-add-btn {
                flex: 1;
                padding: 12px 20px;
                border: none;
                border-radius: 12px;
                font-family: 'Bungee', cursive;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .costnest-cancel-btn {
                background: rgba(0, 0, 0, 0.1);
                color: #666;
            }
            
            .costnest-cancel-btn:hover {
                background: rgba(0, 0, 0, 0.2);
                color: #333;
            }
            
            .costnest-add-btn {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }
            
            .costnest-add-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
            }
            
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            
            @keyframes slideUp {
                from {
                    opacity: 0;
                    transform: translateY(30px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        
        document.head.appendChild(style);
    }

    setupQuickAddEvents(overlay, data) {
        const closeBtn = overlay.querySelector('.costnest-close-btn');
        const cancelBtn = overlay.querySelector('.costnest-cancel-btn');
        const form = overlay.querySelector('.costnest-quick-add-form');
        
        const closeOverlay = () => {
            overlay.remove();
            this.quickAddOverlay = null;
        };
        
        closeBtn.addEventListener('click', closeOverlay);
        cancelBtn.addEventListener('click', closeOverlay);
        
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeOverlay();
        });
        
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            console.log('CostNest: Form submission started');
            
            const formData = new FormData(form);
            const expenseData = {
                amount: parseFloat(formData.get('amount')),
                description: formData.get('description'),
                category: formData.get('category'),
                date: new Date().toISOString().split('T')[0],
                url: data.url || window.location.href,
                source: 'web_capture'
            };
            
            console.log('CostNest: Expense data prepared:', expenseData);
            
            // Validate expense data
            if (!expenseData.amount || isNaN(expenseData.amount) || expenseData.amount <= 0) {
                this.showNotification('Please enter a valid amount', 'error');
                return;
            }
            
            if (!expenseData.description || expenseData.description.trim() === '') {
                this.showNotification('Please enter a description', 'error');
                return;
            }
            
            try {
                console.log('CostNest: Sending message to background script');
                const response = await safeSendMessage({
                    type: 'ADD_EXPENSE',
                    data: expenseData
                });
                
                console.log('CostNest: Background script response:', response);
                
                if (response && response.success !== false) {
                    this.showNotification('Expense added successfully!', 'success');
                    closeOverlay();
                } else {
                    this.showNotification('Failed to add expense', 'error');
                }
            } catch (error) {
                console.error('CostNest: Error adding expense:', error);
                if (error.message.includes('Extension context invalidated')) {
                    console.log('Extension context invalidated, cannot add expense');
                    this.showNotification('Extension needs to be reloaded', 'error');
                    setTimeout(() => window.location.reload(), 2000);
                } else {
                    this.showNotification('Failed to add expense: ' + error.message, 'error');
                }
            }
        });
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `costnest-notification costnest-notification-${type}`;
        notification.textContent = message;
        
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            z-index: 10002;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            font-family: 'Bungee', cursive;
            font-size: 14px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            animation: slideDown 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideUp 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    setupPriceChangeObserver() {
        // Monitor price changes on product pages
        const observer = new MutationObserver((mutations) => {
            let priceChanged = false;
            
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' || mutation.type === 'characterData') {
                    const target = mutation.target;
                    if (target.nodeType === Node.TEXT_NODE) {
                        const parent = target.parentElement;
                        if (parent && this.isPriceElement(parent)) {
                            priceChanged = true;
                        }
                    } else if (target.nodeType === Node.ELEMENT_NODE) {
                        if (this.isPriceElement(target) || target.querySelector && this.priceSelectors.some(sel => target.querySelector(sel))) {
                            priceChanged = true;
                        }
                    }
                }
            });
            
            if (priceChanged) {
                this.handlePriceChange();
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });
    }

    isPriceElement(element) {
        const className = element.className || '';
        const id = element.id || '';
        return this.priceSelectors.some(selector => {
            const cleanSelector = selector.replace(/[.#\[\]"']/g, '');
            return className.includes(cleanSelector) || id.includes(cleanSelector);
        });
    }

    handlePriceChange() {
        // Debounce price change detection
        clearTimeout(this.priceChangeTimeout);
        this.priceChangeTimeout = setTimeout(() => {
            const currentPrice = this.getCurrentPrice();
            if (currentPrice && validateExtensionContext()) {
                safeSendMessage({
                    type: 'PRICE_CHANGED',
                    data: {
                        url: window.location.href,
                        price: currentPrice,
                        timestamp: new Date().toISOString()
                    }
                }).catch(error => {
                    console.warn('CostNest: Price change notification failed:', error);
                });
            }
        }, 1000);
    }

    trackPriceChanges() {
        // Store initial price for comparison
        const initialPrice = this.getCurrentPrice();
        if (initialPrice && validateExtensionContext()) {
            safeSendMessage({
                type: 'TRACK_PRICE',
                data: {
                    url: window.location.href,
                    initialPrice,
                    productInfo: this.extractProductInfo()
                }
            }).catch(error => {
                console.warn('CostNest: Price tracking setup failed:', error);
            });
        }
    }

    detectReceiptData() {
        // Look for receipt-like patterns on the page
        const receiptIndicators = [
            'receipt',
            'invoice',
            'order confirmation',
            'purchase summary',
            'transaction',
            'order details'
        ];
        
        const pageText = document.body.textContent.toLowerCase();
        const isReceiptPage = receiptIndicators.some(indicator => pageText.includes(indicator));
        
        if (!isReceiptPage) return null;
        
        // Extract receipt data
        const items = this.extractReceiptItems();
        const total = this.extractReceiptTotal();
        const date = this.extractReceiptDate();
        const merchant = this.extractMerchant();
        
        return {
            items,
            total,
            date,
            merchant,
            url: window.location.href,
            extractedAt: new Date().toISOString()
        };
    }

    extractReceiptItems() {
        // This would be more sophisticated in a real implementation
        const items = [];
        const itemRows = document.querySelectorAll('tr, .item, .line-item, [class*="item"]');
        
        itemRows.forEach(row => {
            const text = row.textContent;
            const price = this.extractPriceFromText(text);
            if (price && text.length > 10) {
                items.push({
                    description: text.trim().substring(0, 50),
                    amount: price
                });
            }
        });
        
        return items.slice(0, 10); // Limit to 10 items
    }

    extractReceiptTotal() {
        const totalSelectors = [
            '*:contains("Total")',
            '*:contains("Amount")',
            '*:contains("Sum")',
            '.total',
            '.amount',
            '#total'
        ];
        
        for (const selector of totalSelectors) {
            try {
                const elements = document.querySelectorAll(selector);
                for (const element of elements) {
                    const price = this.extractPriceFromText(element.textContent);
                    if (price) return price;
                }
            } catch (error) {
                // Ignore selector errors
            }
        }
        
        return null;
    }

    extractReceiptDate() {
        const dateRegex = /\b\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}\b|\b\d{4}[\/-]\d{1,2}[\/-]\d{1,2}\b/;
        const pageText = document.body.textContent;
        const match = pageText.match(dateRegex);
        return match ? match[0] : new Date().toISOString().split('T')[0];
    }

    extractMerchant() {
        // Try to extract merchant name from various sources
        const sources = [
            document.title,
            document.querySelector('h1')?.textContent,
            document.querySelector('.merchant, .store, .company')?.textContent,
            window.location.hostname
        ];
        
        for (const source of sources) {
            if (source && source.trim().length > 0) {
                return source.trim().substring(0, 50);
            }
        }
        
        return 'Unknown Merchant';
    }
}

// Initialize content script
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new ContentScriptManager();
    });
} else {
    new ContentScriptManager();
}