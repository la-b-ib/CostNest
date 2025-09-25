// Background Service Worker for CostNest
class BackgroundService {
    constructor() {
        this.initializeBackground();
    }

    initializeBackground() {
        try {
            this.setupEventListeners();
            this.setupAlarms();
            this.setupNotifications();
            this.setupContextMenus();
            console.log('CostNest background service initialized');
        } catch (error) {
            console.error('Failed to initialize background service:', error);
        }
    }

    setupEventListeners() {
        // Extension installation/update
        chrome.runtime.onInstalled.addListener((details) => {
            this.handleInstallation(details);
        });

        // Extension startup
        chrome.runtime.onStartup.addListener(() => {
            this.handleStartup();
        });

        // Message handling from popup/content scripts
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });

        // Alarm handling
        chrome.alarms.onAlarm.addListener((alarm) => {
            this.handleAlarm(alarm);
        });

        // Tab updates for price tracking
        chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
            this.handleTabUpdate(tabId, changeInfo, tab);
        });

        // Notification clicks
        chrome.notifications.onClicked.addListener((notificationId) => {
            this.handleNotificationClick(notificationId);
        });
    }

    async handleInstallation(details) {
        if (details.reason === 'install') {
            // First time installation
            await this.setupDefaultData();
            this.showWelcomeNotification();
        } else if (details.reason === 'update') {
            // Extension update
            await this.handleUpdate(details.previousVersion);
        }
    }

    async setupDefaultData() {
        // Initialize default settings and data
        const defaultSettings = {
            currency: 'USD',
            currencySymbol: '$',
            notifications: true,
            priceAlerts: true,
            theme: 'default',
            autoLock: true,
            lockTimeout: 5 * 60 * 1000 // 5 minutes
        };

        const defaultCategories = [
            { id: 'food', name: 'Food & Dining', icon: 'restaurant', color: '#FF6B6B' },
            { id: 'shopping', name: 'Shopping', icon: 'shopping_bag', color: '#4ECDC4' },
            { id: 'entertainment', name: 'Entertainment', icon: 'movie', color: '#45B7D1' },
            { id: 'transport', name: 'Transportation', icon: 'directions_car', color: '#96CEB4' },
            { id: 'bills', name: 'Bills & Utilities', icon: 'receipt', color: '#FFEAA7' },
            { id: 'health', name: 'Health & Fitness', icon: 'fitness_center', color: '#DDA0DD' },
            { id: 'other', name: 'Other', icon: 'category', color: '#A8A8A8' }
        ];

        try {
            await chrome.storage.local.set({
                'costnest_settings': defaultSettings,
                'costnest_categories': defaultCategories,
                'costnest_expenses': [],
                'costnest_price_alerts': []
            });
        } catch (error) {
            console.error('Failed to setup default data:', error);
        }
    }

    async handleUpdate(previousVersion) {
        console.log(`Updated from version ${previousVersion}`);
        // Handle any migration logic here
    }

    handleStartup() {
        // Set up daily reminder alarm
        this.setupDailyReminder();
        // Check for price alerts
        this.checkPriceAlerts();
    }

    handleTabUpdate(tabId, changeInfo, tab) {
        // Handle tab updates for price tracking or other features
        // Currently this is a placeholder method to prevent errors
        if (changeInfo.status === 'complete' && tab.url) {
            // Future: Could implement price tracking on specific sites
            console.log('Tab updated:', tab.url);
        }
    }

    async handleMessage(message, sender, sendResponse) {
        try {
            console.log('CostNest Background: Received message:', message.type, message.data);
            switch (message.type) {
                case 'ADD_EXPENSE':
                    console.log('CostNest Background: Processing ADD_EXPENSE');
                    await this.addExpenseFromContent(message.data);
                    console.log('CostNest Background: Expense added successfully');
                    sendResponse({ success: true });
                    break;
                
                case 'GET_PRICE_ALERTS':
                    const alerts = await this.getPriceAlerts();
                    sendResponse({ alerts });
                    break;
                
                case 'SET_PRICE_ALERT':
                    await this.setPriceAlert(message.data);
                    sendResponse({ success: true });
                    break;
                
                case 'CAPTURE_RECEIPT':
                    const receiptData = await this.processReceipt(message.data);
                    sendResponse({ receiptData });
                    break;
                
                case 'BACKUP_DATA':
                    const backupData = await this.createBackup();
                    sendResponse({ backupData });
                    break;
                
                default:
                    sendResponse({ error: 'Unknown message type' });
            }
        } catch (error) {
            console.error('Message handling error:', error);
            sendResponse({ error: error.message });
        }
    }

    setupAlarms() {
        // Daily reminder alarm
        chrome.alarms.create('dailyReminder', {
            when: this.getNextReminderTime(),
            periodInMinutes: 24 * 60 // 24 hours
        });

        // Budget check alarm (weekly)
        chrome.alarms.create('budgetCheck', {
            when: Date.now() + (7 * 24 * 60 * 60 * 1000), // 1 week from now
            periodInMinutes: 7 * 24 * 60 // 1 week
        });

        // Price alert check (every 4 hours)
        chrome.alarms.create('priceAlertCheck', {
            when: Date.now() + (4 * 60 * 60 * 1000), // 4 hours from now
            periodInMinutes: 4 * 60 // 4 hours
        });
    }

    getNextReminderTime() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(19, 0, 0, 0); // 7 PM
        return tomorrow.getTime();
    }

    async handleAlarm(alarm) {
        switch (alarm.name) {
            case 'dailyReminder':
                await this.sendDailyReminder();
                break;
            
            case 'budgetCheck':
                await this.checkBudgetStatus();
                break;
            
            case 'priceAlertCheck':
                await this.checkPriceAlerts();
                break;
        }
    }

    async sendDailyReminder() {
        const settings = await chrome.storage.local.get(['costnest_settings']);
        if (!settings.costnest_settings?.notifications) return;

        const today = new Date().toISOString().split('T')[0];
        const expenses = await chrome.storage.local.get(['costnest_expenses']);
        const todayExpenses = expenses.costnest_expenses?.filter(exp => exp.date === today) || [];

        if (todayExpenses.length === 0) {
            this.createNotification(
                'dailyReminder',
                'Daily Expense Reminder',
                "Don't forget to log your expenses today! 💰",
                'icons/icon48.svg'
            );
        }
    }

    async checkBudgetStatus() {
        const budget = await chrome.storage.local.get(['costnest_budget']);
        if (!budget.costnest_budget) return;

        const monthlyTotal = await this.getMonthlyTotal();
        const budgetAmount = budget.costnest_budget.amount;
        const percentage = (monthlyTotal / budgetAmount) * 100;

        if (percentage >= 90) {
            this.createNotification(
                'budgetAlert',
                'Budget Alert! 🚨',
                `You've used ${percentage.toFixed(0)}% of your monthly budget.`,
                'icons/icon48.svg'
            );
        }
    }

    async getMonthlyTotal() {
        const expenses = await chrome.storage.local.get(['costnest_expenses']);
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();

        const monthlyExpenses = expenses.costnest_expenses?.filter(exp => {
            const expenseDate = new Date(exp.date);
            return expenseDate.getFullYear() === year && expenseDate.getMonth() === month;
        }) || [];

        return monthlyExpenses.reduce((total, exp) => total + parseFloat(exp.amount), 0);
    }

    async checkPriceAlerts() {
        const alerts = await chrome.storage.local.get(['costnest_price_alerts']);
        const priceAlerts = alerts.costnest_price_alerts || [];

        for (const alert of priceAlerts) {
            if (alert.isActive) {
                try {
                    const currentPrice = await this.fetchCurrentPrice(alert.productUrl);
                    if (currentPrice && currentPrice <= alert.targetPrice) {
                        this.createNotification(
                            `priceAlert_${alert.id}`,
                            'Price Drop Alert! 🎉',
                            `${alert.productName} is now $${currentPrice} (target: $${alert.targetPrice})`,
                            'icons/icon48.svg'
                        );
                        
                        // Deactivate the alert
                        alert.isActive = false;
                        await chrome.storage.local.set({ 'costnest_price_alerts': priceAlerts });
                    }
                } catch (error) {
                    console.error('Price check failed for alert:', alert.id, error);
                }
            }
        }
    }

    async fetchCurrentPrice(url) {
        // This would integrate with a price tracking API
        // For now, return null as placeholder
        return null;
    }

    setupNotifications() {
        // Service workers don't have access to window.Notification
        // We'll use chrome.notifications API directly
        
        // Setup notification handlers
        chrome.notifications.onClicked.addListener((notificationId) => {
            this.handleNotificationClick(notificationId);
        });
        
        // Setup notification buttons if supported
        chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
            this.handleNotificationButtonClick(notificationId, buttonIndex);
        });
    }

    handleNotificationButtonClick(notificationId, buttonIndex) {
        // Handle notification button clicks
        if (notificationId.startsWith('budget')) {
            if (buttonIndex === 0) {
                // Open expense tracker
                chrome.action.openPopup();
            }
        }
        chrome.notifications.clear(notificationId);
    }

    setupContextMenus() {
        try {
            // Clear existing context menus to avoid duplicate ID errors
            chrome.contextMenus.removeAll(() => {
                chrome.contextMenus.create({
                    id: 'addExpense',
                    title: 'Add to CostNest',
                    contexts: ['selection', 'link'],
                    documentUrlPatterns: ['https://*/*', 'http://*/*']
                });

                chrome.contextMenus.create({
                    id: 'trackPrice',
                    title: 'Track Price with CostNest',
                    contexts: ['link'],
                    documentUrlPatterns: ['https://*/*']
                });
            });

            chrome.contextMenus.onClicked.addListener((info, tab) => {
                this.handleContextMenuClick(info, tab);
            });
        } catch (error) {
            console.error('Failed to setup context menus:', error);
        }
    }

    async handleContextMenuClick(info, tab) {
        switch (info.menuItemId) {
            case 'addExpense':
                await this.handleAddExpenseFromContext(info, tab);
                break;
            
            case 'trackPrice':
                await this.handleTrackPriceFromContext(info, tab);
                break;
        }
    }

    async handleAddExpenseFromContext(info, tab) {
        const selectedText = info.selectionText;
        const amount = this.extractAmountFromText(selectedText);
        
        if (amount) {
            // Send message to content script to show quick add form
            chrome.tabs.sendMessage(tab.id, {
                type: 'SHOW_QUICK_ADD',
                data: {
                    amount,
                    description: selectedText,
                    url: tab.url,
                    title: tab.title
                }
            });
        }
    }

    extractAmountFromText(text) {
        const amountRegex = /\$?([0-9]+(?:\.[0-9]{2})?)/;
        const match = text.match(amountRegex);
        return match ? parseFloat(match[1]) : null;
    }

    async handleTrackPriceFromContext(info, tab) {
        // Extract product information and set up price tracking
        chrome.tabs.sendMessage(tab.id, {
            type: 'EXTRACT_PRODUCT_INFO',
            data: {
                url: info.linkUrl || tab.url
            }
        });
    }

    createNotification(id, title, message, iconUrl) {
        chrome.notifications.create(id, {
            type: 'basic',
            iconUrl: iconUrl,
            title: title,
            message: message,
            priority: 1
        });
    }

    handleNotificationClick(notificationId) {
        // Open extension popup when notification is clicked
        chrome.action.openPopup();
        
        // Clear the notification
        chrome.notifications.clear(notificationId);
    }

    async addExpenseFromContent(expenseData) {
        console.log('CostNest Background: addExpenseFromContent called with:', expenseData);
        
        const expenses = await chrome.storage.local.get(['costnest_expenses']);
        const currentExpenses = expenses.costnest_expenses || [];
        
        console.log('CostNest Background: Current expenses count:', currentExpenses.length);
        
        const newExpense = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            ...expenseData,
            createdAt: new Date().toISOString()
        };
        
        console.log('CostNest Background: New expense created:', newExpense);
        
        currentExpenses.push(newExpense);
        await chrome.storage.local.set({ 'costnest_expenses': currentExpenses });
        
        console.log('CostNest Background: Expense saved to storage, new count:', currentExpenses.length);
        
        // Send confirmation notification
        this.createNotification(
            'expenseAdded',
            'Expense Added! ✅',
            `$${expenseData.amount} - ${expenseData.description}`,
            'icons/icon48.svg'
        );
        
        console.log('CostNest Background: Notification sent');
    }

    async getPriceAlerts() {
        const alerts = await chrome.storage.local.get(['costnest_price_alerts']);
        return alerts.costnest_price_alerts || [];
    }

    async setPriceAlert(alertData) {
        const alerts = await chrome.storage.local.get(['costnest_price_alerts']);
        const currentAlerts = alerts.costnest_price_alerts || [];
        
        const newAlert = {
            id: Date.now().toString(36) + Math.random().toString(36).substr(2),
            ...alertData,
            createdAt: new Date().toISOString(),
            isActive: true
        };
        
        currentAlerts.push(newAlert);
        await chrome.storage.local.set({ 'costnest_price_alerts': currentAlerts });
    }

    async processReceipt(receiptData) {
        // OCR processing would go here
        // For now, return placeholder data
        return {
            amount: 0,
            description: 'Receipt processed',
            category: 'other',
            date: new Date().toISOString().split('T')[0],
            items: []
        };
    }

    async createBackup() {
        const data = await chrome.storage.local.get(null);
        return {
            ...data,
            exportDate: new Date().toISOString(),
            version: '1.0.0'
        };
    }

    showWelcomeNotification() {
        this.createNotification(
            'welcome',
            'Welcome to CostNest! 🎉',
            'Your secure expense tracker is ready to use. Click to get started!',
            'icons/icon48.svg'
        );
    }

    setupDailyReminder() {
        const reminderTime = this.getNextReminderTime();
        chrome.alarms.create('dailyReminder', {
            when: reminderTime,
            periodInMinutes: 24 * 60
        });
    }

    // Security utilities
    async encryptData(data, key) {
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(JSON.stringify(data));
        const encrypted = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv: crypto.getRandomValues(new Uint8Array(12)) },
            key,
            dataBuffer
        );
        return encrypted;
    }

    async decryptData(encryptedData, key) {
        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: encryptedData.iv },
            key,
            encryptedData.data
        );
        const decoder = new TextDecoder();
        return JSON.parse(decoder.decode(decrypted));
    }
}

// Initialize background service
const backgroundService = new BackgroundService();