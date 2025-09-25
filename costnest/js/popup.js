// Main Popup Controller for CostNest
class PopupController {
    constructor() {
        this.currentScreen = 'pin-screen';
        this.isInitialized = false;
        this.initializePopup();
    }

    async initializePopup() {
        try {
            // Wait for all managers to be available
            await this.waitForManagers();
            
            // Setup navigation event listeners
            this.setupNavigationListeners();
            
            // Setup settings event listeners
            this.setupSettingsListeners();
            
            // Initialize UI updates
            this.setupPeriodicUpdates();
            
            // Update PIN setting display
            this.updatePINSettingDisplay();
            
            // Request notification permission
            this.requestNotificationPermission();
            
            this.isInitialized = true;
            console.log('CostNest popup initialized successfully');
        } catch (error) {
            console.error('Failed to initialize popup:', error);
            this.showError('Failed to initialize CostNest. Please refresh and try again.');
        }
    }

    async waitForManagers() {
        const maxWait = 5000; // 5 seconds
        const startTime = Date.now();
        
        while (Date.now() - startTime < maxWait) {
            if (window.storageManager && window.authManager && window.expenseManager && window.chartManager) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        throw new Error('Managers failed to initialize within timeout');
    }

    setupNavigationListeners() {
        // Settings navigation
        document.getElementById('settings-btn').addEventListener('click', () => {
            this.showScreen('settings-screen');
            this.updatePINSettingDisplay();
        });

        document.getElementById('back-to-main-settings').addEventListener('click', () => {
            this.showScreen('main-screen');
        });

        // Screen transitions with animation
        this.setupScreenTransitions();
    }

    setupScreenTransitions() {
        const screens = document.querySelectorAll('.screen');
        
        screens.forEach(screen => {
            screen.addEventListener('transitionend', (e) => {
                if (e.propertyName === 'opacity' && e.target.style.opacity === '0') {
                    e.target.style.display = 'none';
                }
            });
        });
    }

    setupSettingsListeners() {
        // Backup data
        document.getElementById('backup-btn').addEventListener('click', async () => {
            await this.handleBackup();
        });

        // Restore data
        document.getElementById('restore-btn').addEventListener('click', () => {
            this.handleRestore();
        });

        // Export CSV
        document.getElementById('export-csv-btn').addEventListener('click', async () => {
            await this.handleCSVExport();
        });

        // Budget settings
        document.getElementById('budget-btn').addEventListener('click', () => {
            this.showBudgetDialog();
        });

        // PIN setting (Set up or Change PIN)
        document.getElementById('pin-setting-btn').addEventListener('click', () => {
            this.handlePINSetting();
        });
    }

    setupPeriodicUpdates() {
        // Update UI every 30 seconds
        setInterval(() => {
            if (this.isInitialized && window.expenseManager) {
                window.expenseManager.updateUI();
            }
        }, 30000);

        // Update charts every minute
        setInterval(() => {
            if (this.isInitialized && window.chartManager) {
                window.chartManager.updateCharts();
            }
        }, 60000);
    }

    setupNotifications() {
        // Setup notification preferences and handlers
        this.requestNotificationPermission();
        
        // Listen for notification settings changes
        document.addEventListener('settingsChanged', (event) => {
            if (event.detail.setting === 'notifications') {
                this.updateNotificationSettings(event.detail.value);
            }
        });
    }

    updateNotificationSettings(enabled) {
        // Update notification preferences
        if (enabled && Notification.permission !== 'granted') {
            this.requestNotificationPermission();
        }
    }

    showScreen(screenId) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        // Show target screen
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
            this.currentScreen = screenId;
            
            // Update UI when showing main screen
            if (screenId === 'main-screen' && window.expenseManager) {
                window.expenseManager.updateUI();
            }
        }
    }

    async handleBackup() {
        try {
            const data = await window.storageManager.exportData();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `costnest-backup-${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            
            URL.revokeObjectURL(url);
            this.showNotification('Backup created successfully!', 'success');
        } catch (error) {
            console.error('Backup failed:', error);
            this.showNotification('Failed to create backup. Please try again.', 'error');
        }
    }

    handleRestore() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const data = JSON.parse(text);
                
                // Validate backup data
                if (!this.validateBackupData(data)) {
                    this.showNotification('Invalid backup file format.', 'error');
                    return;
                }
                
                // Confirm restore
                if (confirm('This will replace all your current data. Are you sure you want to continue?')) {
                    const success = await window.storageManager.importData(data);
                    if (success) {
                        this.showNotification('Data restored successfully!', 'success');
                        // Refresh UI
                        setTimeout(() => {
                            window.location.reload();
                        }, 1000);
                    } else {
                        this.showNotification('Failed to restore data. Please try again.', 'error');
                    }
                }
            } catch (error) {
                console.error('Restore failed:', error);
                this.showNotification('Failed to read backup file. Please check the file format.', 'error');
            }
        };
        
        input.click();
    }

    validateBackupData(data) {
        return data && 
               typeof data === 'object' && 
               Array.isArray(data.expenses) && 
               data.version;
    }

    async handleCSVExport() {
        try {
            const csvContent = await window.storageManager.exportToCSV();
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `costnest-expenses-${new Date().toISOString().split('T')[0]}.csv`;
            link.click();
            
            URL.revokeObjectURL(url);
            this.showNotification('CSV exported successfully!', 'success');
        } catch (error) {
            console.error('CSV export failed:', error);
            this.showNotification('Failed to export CSV. Please try again.', 'error');
        }
    }

    showBudgetDialog() {
        const dialog = this.createBudgetDialog();
        document.body.appendChild(dialog);
        
        // Animate in
        setTimeout(() => {
            dialog.style.opacity = '1';
            dialog.querySelector('.dialog-content').style.transform = 'scale(1)';
        }, 10);
    }

    createBudgetDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'dialog-overlay';
        dialog.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>Set Monthly Budget</h3>
                    <button class="close-btn">
                        <span class="material-icons">close</span>
                    </button>
                </div>
                <div class="dialog-body">
                    <div class="form-group">
                        <label for="budget-amount">Monthly Budget Amount</label>
                        <div class="input-group">
                            <span class="currency-symbol">$</span>
                            <input type="number" id="budget-amount" step="0.01" placeholder="0.00" required>
                        </div>
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="action-btn secondary cancel-btn">Cancel</button>
                    <button class="action-btn primary save-btn">Save Budget</button>
                </div>
            </div>
        `;
        
        // Style the dialog
        Object.assign(dialog.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '10000',
            opacity: '0',
            transition: 'opacity 0.3s ease'
        });
        
        const dialogContent = dialog.querySelector('.dialog-content');
        Object.assign(dialogContent.style, {
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(20px)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            padding: '24px',
            minWidth: '300px',
            maxWidth: '400px',
            color: '#ffffff',
            transform: 'scale(0.9)',
            transition: 'transform 0.3s ease'
        });
        
        // Event listeners
        dialog.querySelector('.close-btn').addEventListener('click', () => {
            this.closeDialog(dialog);
        });
        
        dialog.querySelector('.cancel-btn').addEventListener('click', () => {
            this.closeDialog(dialog);
        });
        
        dialog.querySelector('.save-btn').addEventListener('click', async () => {
            const amount = parseFloat(dialog.querySelector('#budget-amount').value);
            if (amount && amount > 0) {
                const success = await window.storageManager.setBudget(amount);
                if (success) {
                    this.showNotification('Budget saved successfully!', 'success');
                    this.closeDialog(dialog);
                    // Update UI
                    if (window.expenseManager) {
                        window.expenseManager.updateUI();
                    }
                } else {
                    this.showNotification('Failed to save budget. Please try again.', 'error');
                }
            } else {
                this.showNotification('Please enter a valid budget amount.', 'error');
            }
        });
        
        // Load current budget
        this.loadCurrentBudget(dialog);
        
        return dialog;
    }

    async loadCurrentBudget(dialog) {
        const budget = await window.storageManager.getBudget();
        if (budget) {
            dialog.querySelector('#budget-amount').value = budget.amount;
        }
    }

    closeDialog(dialog) {
        dialog.style.opacity = '0';
        dialog.querySelector('.dialog-content').style.transform = 'scale(0.9)';
        setTimeout(() => {
            if (dialog.parentNode) {
                dialog.parentNode.removeChild(dialog);
            }
        }, 300);
    }

    async handlePINSetting() {
        const hasPIN = await window.storageManager.hasPIN();
        
        if (hasPIN) {
            // User has a PIN - offer to change or disable it
            this.showPINOptionsDialog();
        } else {
            // No PIN set - offer to set one up
            this.showSetupPINDialog();
        }
    }

    async updatePINSettingDisplay() {
        const hasPIN = await window.storageManager.hasPIN();
        const pinSettingText = document.getElementById('pin-setting-text');
        
        if (pinSettingText) {
            pinSettingText.textContent = hasPIN ? 'PIN Protection Settings' : 'Set up PIN Protection';
        }
    }

    showSetupPINDialog() {
        if (window.authManager) {
            window.authManager.showSetupPINMode();
            this.showScreen('pin-screen');
        }
    }

    showPINOptionsDialog() {
        const dialog = this.createPINOptionsDialog();
        document.body.appendChild(dialog);
        
        // Animate in
        setTimeout(() => {
            dialog.style.opacity = '1';
            dialog.querySelector('.dialog-content').style.transform = 'scale(1)';
        }, 10);
    }

    createPINOptionsDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'dialog-overlay';
        dialog.innerHTML = `
            <div class="dialog-content">
                <div class="dialog-header">
                    <h3>PIN Protection Settings</h3>
                    <button class="close-btn">
                        <span class="material-icons">close</span>
                    </button>
                </div>
                <div class="dialog-body">
                    <div class="pin-options">
                        <button class="action-btn secondary full-width" id="change-pin-option">
                            <span class="material-icons">edit</span>
                            Change PIN
                        </button>
                        <button class="action-btn secondary full-width" id="disable-pin-option" style="margin-top: 12px;">
                            <span class="material-icons">lock_open</span>
                            Disable PIN Protection
                        </button>
                    </div>
                </div>
                <div class="dialog-footer">
                    <button class="action-btn secondary cancel-btn">Cancel</button>
                </div>
            </div>
        `;
        
        // Style the dialog
        Object.assign(dialog.style, {
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            height: '100%',
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: '10000',
            opacity: '0',
            transition: 'opacity 0.3s ease'
        });
        
        const dialogContent = dialog.querySelector('.dialog-content');
        Object.assign(dialogContent.style, {
            background: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(20px)',
            borderRadius: '16px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            padding: '24px',
            minWidth: '300px',
            maxWidth: '400px',
            color: '#ffffff',
            transform: 'scale(0.9)',
            transition: 'transform 0.3s ease'
        });
        
        // Event listeners
        dialog.querySelector('.close-btn').addEventListener('click', () => {
            this.closeDialog(dialog);
        });
        
        dialog.querySelector('.cancel-btn').addEventListener('click', () => {
            this.closeDialog(dialog);
        });
        
        dialog.querySelector('#change-pin-option').addEventListener('click', () => {
            this.closeDialog(dialog);
            if (window.authManager) {
                window.authManager.showChangePINMode();
                this.showScreen('pin-screen');
            }
        });
        
        dialog.querySelector('#disable-pin-option').addEventListener('click', async () => {
            if (confirm('Are you sure you want to disable PIN protection? Your expense data will be accessible without authentication.')) {
                await window.storageManager.remove(window.storageManager.storageKeys.PIN);
                this.showNotification('PIN protection disabled', 'success');
                await this.updatePINSettingDisplay();
                this.closeDialog(dialog);
            }
        });
        
        return dialog;
    }

    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            try {
                await Notification.requestPermission();
            } catch (error) {
                console.log('Notification permission request failed:', error);
            }
        }
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '12px 24px',
            borderRadius: '8px',
            color: '#ffffff',
            fontFamily: 'Bungee, cursive',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: '10000',
            opacity: '0',
            transition: 'all 0.3s ease',
            maxWidth: '300px',
            textAlign: 'center'
        });
        
        // Set background color based on type
        switch (type) {
            case 'error':
                notification.style.background = 'rgba(244, 67, 54, 0.9)';
                break;
            case 'success':
                notification.style.background = 'rgba(76, 175, 80, 0.9)';
                break;
            case 'warning':
                notification.style.background = 'rgba(255, 152, 0, 0.9)';
                break;
            default:
                notification.style.background = 'rgba(33, 150, 243, 0.9)';
        }
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(-50%) translateY(0)';
        }, 100);
        
        // Remove after delay
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(-50%) translateY(-20px)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 4000);
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    // Keyboard shortcuts
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Escape key to go back
            if (e.key === 'Escape') {
                if (this.currentScreen !== 'main-screen' && this.currentScreen !== 'pin-screen') {
                    this.showScreen('main-screen');
                }
            }
            
            // Ctrl/Cmd + N for new expense
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                if (this.currentScreen === 'main-screen' && window.expenseManager) {
                    window.expenseManager.showAddExpenseScreen();
                }
            }
        });
    }

    // Performance monitoring
    monitorPerformance() {
        const observer = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                if (entry.duration > 100) {
                    console.warn(`Slow operation detected: ${entry.name} took ${entry.duration}ms`);
                }
            }
        });
        
        observer.observe({ entryTypes: ['measure'] });
    }

    // Error handling
    setupErrorHandling() {
        window.addEventListener('error', (e) => {
            console.error('Global error:', e.error);
            this.showError('An unexpected error occurred. Please refresh the extension.');
        });
        
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled promise rejection:', e.reason);
            this.showError('An unexpected error occurred. Please refresh the extension.');
        });
    }
}

// Add dialog styles to the document
const dialogCSS = `
.dialog-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.dialog-header h3 {
    margin: 0;
    font-family: 'Bungee', cursive;
    font-size: 18px;
    font-weight: 500;
}

.close-btn {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #ffffff;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.3s ease;
}

.close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
}

.dialog-body {
    margin-bottom: 24px;
}

.dialog-footer {
    display: flex;
    gap: 12px;
    justify-content: flex-end;
}
`;

const dialogStyle = document.createElement('style');
dialogStyle.textContent = dialogCSS;
document.head.appendChild(dialogStyle);

// Initialize popup controller when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.popupController = new PopupController();
});