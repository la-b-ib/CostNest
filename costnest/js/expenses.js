// Expense Management for CostNest
class ExpenseManager {
    constructor() {
        this.currentExpenses = [];
        this.categories = [];
        this.currentCurrency = '$';
        this.initializeExpenseManager();
    }

    async initializeExpenseManager() {
        await this.loadCategories();
        await this.loadExpenses();
        this.setupEventListeners();
        this.updateUI();
    }

    async loadCategories() {
        this.categories = await window.storageManager.get(window.storageManager.storageKeys.CATEGORIES) || [];
    }

    async loadExpenses() {
        this.currentExpenses = await window.storageManager.getExpenses();
    }

    setupEventListeners() {
        // Add expense button
        document.getElementById('add-expense-btn').addEventListener('click', () => {
            this.showAddExpenseScreen();
        });

        // Back buttons
        document.getElementById('back-to-main').addEventListener('click', () => {
            this.showMainScreen();
        });

        document.getElementById('back-to-main-expenses').addEventListener('click', () => {
            this.showMainScreen();
        });

        // Expense form submission
        document.getElementById('expense-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleExpenseSubmission();
        });

        // View all expenses
        document.getElementById('view-all-btn').addEventListener('click', () => {
            this.showAllExpensesScreen();
        });

        // Auto-fill current date
        document.getElementById('date').valueAsDate = new Date();

        // Smart category suggestions
        document.getElementById('description').addEventListener('input', (e) => {
            this.suggestCategory(e.target.value);
        });

        // Amount input formatting
        document.getElementById('amount').addEventListener('input', (e) => {
            this.formatAmountInput(e.target);
        });
    }

    showAddExpenseScreen() {
        document.getElementById('main-screen').classList.remove('active');
        document.getElementById('add-expense-screen').classList.add('active');
        
        // Reset form
        document.getElementById('expense-form').reset();
        document.getElementById('date').valueAsDate = new Date();
        
        // Focus on amount field
        setTimeout(() => {
            document.getElementById('amount').focus();
        }, 300);
    }

    showMainScreen() {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById('main-screen').classList.add('active');
        this.updateUI();
    }

    showAllExpensesScreen() {
        document.getElementById('main-screen').classList.remove('active');
        document.getElementById('all-expenses-screen').classList.add('active');
        this.displayAllExpenses();
    }

    async displayAllExpenses() {
        const expensesContainer = document.getElementById('all-expenses-list');
        if (!expensesContainer) {
            console.error('All expenses container not found');
            return;
        }

        const expenses = await window.storageManager.getExpenses();
        
        if (expenses.length === 0) {
            expensesContainer.innerHTML = '<div class="no-expenses">No expenses found</div>';
            return;
        }

        // Sort expenses by date (newest first)
        expenses.sort((a, b) => new Date(b.date) - new Date(a.date));

        expensesContainer.innerHTML = expenses.map(expense => `
            <div class="expense-item">
                <div class="expense-header">
                    <span class="expense-amount">${this.formatCurrency(expense.amount)}</span>
                    <span class="expense-date">${new Date(expense.date).toLocaleDateString()}</span>
                </div>
                <div class="expense-details">
                    <span class="expense-description">${expense.description}</span>
                    <span class="expense-category">${this.getCategoryName(expense.category)}</span>
                </div>
            </div>
        `).join('');
    }

    async handleExpenseSubmission() {
        // Get form values directly from input elements instead of using FormData
        const amountInput = document.getElementById('amount');
        const descriptionInput = document.getElementById('description');
        const categorySelect = document.getElementById('category');
        const dateInput = document.getElementById('date');
        
        const expense = {
            amount: parseFloat(amountInput.value),
            description: descriptionInput.value.trim(),
            category: categorySelect.value,
            date: dateInput.value,
            currency: this.currentCurrency
        };

        // Validation
        if (!this.validateExpense(expense)) {
            return;
        }

        // Add expense to storage
        const success = await window.storageManager.addExpense(expense);
        
        if (success) {
            this.showNotification('Expense added successfully!', 'success');
            await this.loadExpenses();
            this.showMainScreen();
            
            // Check budget alerts
            this.checkBudgetAlerts();
        } else {
            this.showNotification('Failed to add expense. Please try again.', 'error');
        }
    }

    validateExpense(expense) {
        if (!expense.amount || expense.amount <= 0) {
            this.showNotification('Please enter a valid amount', 'error');
            return false;
        }

        if (!expense.description) {
            this.showNotification('Please enter a description', 'error');
            return false;
        }

        if (!expense.category) {
            this.showNotification('Please select a category', 'error');
            return false;
        }

        if (!expense.date) {
            this.showNotification('Please select a date', 'error');
            return false;
        }

        return true;
    }

    async updateUI() {
        await this.updateMonthlyStats();
        await this.updateBudgetInfo();
        this.updateRecentExpenses();
    }

    async updateMonthlyStats() {
        const monthlyTotal = await window.storageManager.getMonthlyTotal();
        const monthlyTotalElement = document.getElementById('monthly-total');
        
        if (monthlyTotalElement) {
            monthlyTotalElement.textContent = this.formatCurrency(monthlyTotal);
        }
    }

    async updateBudgetInfo() {
        const budget = await window.storageManager.getBudget();
        const monthlyTotal = await window.storageManager.getMonthlyTotal();
        const budgetLeftElement = document.getElementById('budget-left');
        
        if (budgetLeftElement) {
            if (budget) {
                const remaining = budget.amount - monthlyTotal;
                budgetLeftElement.textContent = this.formatCurrency(Math.max(0, remaining));
                
                // Update color based on budget status
                if (remaining < 0) {
                    budgetLeftElement.style.color = '#ff4444';
                } else if (remaining < budget.amount * 0.2) {
                    budgetLeftElement.style.color = '#ff9800';
                } else {
                    budgetLeftElement.style.color = '#4caf50';
                }
            } else {
                budgetLeftElement.textContent = 'No budget set';
                budgetLeftElement.style.color = '#ffffff';
            }
        }
    }

    updateRecentExpenses() {
        // This would populate a recent expenses list if we had that UI element
        // For now, we'll just log the recent expenses
        const recentExpenses = this.currentExpenses.slice(0, 5);
        console.log('Recent expenses:', recentExpenses);
    }

    suggestCategory(description) {
        const keywords = {
            'food': ['restaurant', 'food', 'lunch', 'dinner', 'breakfast', 'coffee', 'pizza', 'burger', 'meal'],
            'shopping': ['amazon', 'store', 'clothes', 'shirt', 'shoes', 'shopping', 'buy', 'purchase'],
            'entertainment': ['movie', 'cinema', 'game', 'music', 'netflix', 'spotify', 'concert', 'show'],
            'transport': ['uber', 'taxi', 'bus', 'train', 'gas', 'fuel', 'parking', 'metro'],
            'bills': ['electric', 'water', 'internet', 'phone', 'rent', 'mortgage', 'insurance', 'utility'],
            'health': ['doctor', 'medicine', 'pharmacy', 'hospital', 'gym', 'fitness', 'health']
        };

        const lowerDescription = description.toLowerCase();
        
        for (const [category, words] of Object.entries(keywords)) {
            if (words.some(word => lowerDescription.includes(word))) {
                const categorySelect = document.getElementById('category');
                if (categorySelect.value === '') {
                    categorySelect.value = category;
                    this.showNotification(`Suggested category: ${this.getCategoryName(category)}`, 'info');
                }
                break;
            }
        }
    }

    getCategoryName(categoryId) {
        const category = this.categories.find(cat => cat.id === categoryId);
        return category ? category.name : categoryId;
    }

    formatAmountInput(input) {
        let value = input.value.replace(/[^\d.]/g, '');
        
        // Ensure only one decimal point
        const parts = value.split('.');
        if (parts.length > 2) {
            value = parts[0] + '.' + parts.slice(1).join('');
        }
        
        // Limit to 2 decimal places
        if (parts[1] && parts[1].length > 2) {
            value = parts[0] + '.' + parts[1].substring(0, 2);
        }
        
        input.value = value;
    }

    formatCurrency(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD'
        }).format(amount);
    }

    async checkBudgetAlerts() {
        const budget = await window.storageManager.getBudget();
        if (!budget) return;
        
        const monthlyTotal = await window.storageManager.getMonthlyTotal();
        const percentage = (monthlyTotal / budget.amount) * 100;
        
        if (percentage >= 100) {
            this.showNotification('⚠️ Budget exceeded! You\'ve spent more than your monthly budget.', 'error');
            this.sendNotification('Budget Alert', 'You have exceeded your monthly budget!');
        } else if (percentage >= 80) {
            this.showNotification('⚠️ Budget warning! You\'ve used 80% of your monthly budget.', 'warning');
        } else if (percentage >= 50) {
            this.showNotification('💡 You\'ve used 50% of your monthly budget.', 'info');
        }
    }

    async sendNotification(title, message) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(title, {
                body: message,
                icon: 'icons/icon48.png',
                badge: 'icons/icon16.png'
            });
        } else if ('Notification' in window && Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                new Notification(title, {
                    body: message,
                    icon: 'icons/icon48.png',
                    badge: 'icons/icon16.png'
                });
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

    // Advanced features
    async detectDuplicateExpenses(newExpense) {
        const recentExpenses = this.currentExpenses.filter(exp => {
            const expenseDate = new Date(exp.date);
            const newExpenseDate = new Date(newExpense.date);
            const timeDiff = Math.abs(newExpenseDate - expenseDate);
            return timeDiff < 24 * 60 * 60 * 1000; // Within 24 hours
        });

        const duplicates = recentExpenses.filter(exp => 
            exp.amount === newExpense.amount && 
            exp.description.toLowerCase() === newExpense.description.toLowerCase()
        );

        return duplicates.length > 0;
    }

    async getSpendingInsights() {
        const expenses = await window.storageManager.getExpenses();
        const categoryTotals = await window.storageManager.getCategoryTotals();
        
        // Find top spending category
        const topCategory = Object.entries(categoryTotals)
            .sort(([,a], [,b]) => b - a)[0];
        
        // Calculate average daily spending
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const recentExpenses = expenses.filter(exp => 
            new Date(exp.date) >= thirtyDaysAgo
        );
        
        const totalRecent = recentExpenses.reduce((sum, exp) => sum + parseFloat(exp.amount), 0);
        const averageDaily = totalRecent / 30;
        
        return {
            topCategory: topCategory ? {
                name: this.getCategoryName(topCategory[0]),
                amount: topCategory[1]
            } : null,
            averageDaily,
            totalExpenses: expenses.length,
            monthlyTotal: await window.storageManager.getMonthlyTotal()
        };
    }

    // Receipt OCR functionality (placeholder)
    async processReceiptImage(imageFile) {
        // This would integrate with an OCR service
        // For now, return a placeholder
        return {
            amount: 0,
            description: 'Receipt processed',
            category: 'other',
            date: new Date().toISOString().split('T')[0]
        };
    }

    // Price tracking for future purchases
    async trackPriceAlert(productName, targetPrice, currentPrice) {
        const alerts = await window.storageManager.get('price_alerts') || [];
        
        const alert = {
            id: Date.now().toString(),
            productName,
            targetPrice,
            currentPrice,
            createdAt: new Date().toISOString(),
            isActive: true
        };
        
        alerts.push(alert);
        await window.storageManager.set('price_alerts', alerts);
        
        return alert;
    }
}

// Initialize expense manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.expenseManager = new ExpenseManager();
});