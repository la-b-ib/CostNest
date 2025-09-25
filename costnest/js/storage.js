// Storage Management for CostNest
class StorageManager {
    constructor() {
        this.storageKeys = {
            PIN: 'costnest_pin',
            EXPENSES: 'costnest_expenses',
            BUDGET: 'costnest_budget',
            SETTINGS: 'costnest_settings',
            CATEGORIES: 'costnest_categories',
            CURRENCY: 'costnest_currency'
        };
        this.initializeDefaults();
    }

    async initializeDefaults() {
        const defaultSettings = {
            currency: 'USD',
            currencySymbol: '$',
            notifications: true,
            priceAlerts: true,
            theme: 'default'
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

        // Initialize settings if not exists
        const settings = await this.get(this.storageKeys.SETTINGS);
        if (!settings) {
            await this.set(this.storageKeys.SETTINGS, defaultSettings);
        }

        // Initialize categories if not exists
        const categories = await this.get(this.storageKeys.CATEGORIES);
        if (!categories) {
            await this.set(this.storageKeys.CATEGORIES, defaultCategories);
        }

        // Initialize expenses array if not exists
        const expenses = await this.get(this.storageKeys.EXPENSES);
        if (!expenses) {
            await this.set(this.storageKeys.EXPENSES, []);
        }

        // Note: No default PIN is set - PIN is optional and only set when user chooses to enable it
    }

    async set(key, value) {
        try {
            await chrome.storage.local.set({ [key]: value });
            return true;
        } catch (error) {
            console.error('Storage set error:', error);
            return false;
        }
    }

    async get(key) {
        try {
            const result = await chrome.storage.local.get([key]);
            return result[key];
        } catch (error) {
            console.error('Storage get error:', error);
            return null;
        }
    }

    async remove(key) {
        try {
            await chrome.storage.local.remove([key]);
            return true;
        } catch (error) {
            console.error('Storage remove error:', error);
            return false;
        }
    }

    async clear() {
        try {
            await chrome.storage.local.clear();
            return true;
        } catch (error) {
            console.error('Storage clear error:', error);
            return false;
        }
    }

    // PIN Management
    async setPIN(pin) {
        const hashedPIN = await this.hashPIN(pin);
        return await this.set(this.storageKeys.PIN, hashedPIN);
    }

    async verifyPIN(pin) {
        const storedHash = await this.get(this.storageKeys.PIN);
        if (!storedHash) return false;
        
        const hashedPIN = await this.hashPIN(pin);
        return hashedPIN === storedHash;
    }

    async hasPIN() {
        const pin = await this.get(this.storageKeys.PIN);
        return !!pin;
    }

    async hashPIN(pin) {
        const encoder = new TextEncoder();
        const data = encoder.encode(pin + 'costnest_salt');
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Expense Management
    async addExpense(expense) {
        const expenses = await this.get(this.storageKeys.EXPENSES) || [];
        expense.id = this.generateId();
        expense.createdAt = new Date().toISOString();
        expenses.push(expense);
        return await this.set(this.storageKeys.EXPENSES, expenses);
    }

    async updateExpense(id, updatedExpense) {
        const expenses = await this.get(this.storageKeys.EXPENSES) || [];
        const index = expenses.findIndex(exp => exp.id === id);
        if (index !== -1) {
            expenses[index] = { ...expenses[index], ...updatedExpense, updatedAt: new Date().toISOString() };
            return await this.set(this.storageKeys.EXPENSES, expenses);
        }
        return false;
    }

    async deleteExpense(id) {
        const expenses = await this.get(this.storageKeys.EXPENSES) || [];
        const filteredExpenses = expenses.filter(exp => exp.id !== id);
        return await this.set(this.storageKeys.EXPENSES, filteredExpenses);
    }

    async getExpenses(filters = {}) {
        const expenses = await this.get(this.storageKeys.EXPENSES) || [];
        
        let filteredExpenses = expenses;
        
        if (filters.category) {
            filteredExpenses = filteredExpenses.filter(exp => exp.category === filters.category);
        }
        
        if (filters.startDate) {
            filteredExpenses = filteredExpenses.filter(exp => new Date(exp.date) >= new Date(filters.startDate));
        }
        
        if (filters.endDate) {
            filteredExpenses = filteredExpenses.filter(exp => new Date(exp.date) <= new Date(filters.endDate));
        }
        
        return filteredExpenses.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    // Budget Management
    async setBudget(amount, period = 'monthly') {
        const budget = {
            amount: parseFloat(amount),
            period,
            createdAt: new Date().toISOString()
        };
        return await this.set(this.storageKeys.BUDGET, budget);
    }

    async getBudget() {
        return await this.get(this.storageKeys.BUDGET);
    }

    // Analytics
    async getMonthlyTotal(year = new Date().getFullYear(), month = new Date().getMonth()) {
        const expenses = await this.getExpenses();
        const monthlyExpenses = expenses.filter(exp => {
            const expenseDate = new Date(exp.date);
            return expenseDate.getFullYear() === year && expenseDate.getMonth() === month;
        });
        
        return monthlyExpenses.reduce((total, exp) => total + parseFloat(exp.amount), 0);
    }

    async getCategoryTotals(year = new Date().getFullYear(), month = new Date().getMonth()) {
        const expenses = await this.getExpenses();
        const monthlyExpenses = expenses.filter(exp => {
            const expenseDate = new Date(exp.date);
            return expenseDate.getFullYear() === year && expenseDate.getMonth() === month;
        });
        
        const categoryTotals = {};
        monthlyExpenses.forEach(exp => {
            if (!categoryTotals[exp.category]) {
                categoryTotals[exp.category] = 0;
            }
            categoryTotals[exp.category] += parseFloat(exp.amount);
        });
        
        return categoryTotals;
    }

    // Data Export/Import
    async exportData() {
        const data = {
            expenses: await this.get(this.storageKeys.EXPENSES),
            budget: await this.get(this.storageKeys.BUDGET),
            settings: await this.get(this.storageKeys.SETTINGS),
            categories: await this.get(this.storageKeys.CATEGORIES),
            exportDate: new Date().toISOString(),
            version: '1.0.0'
        };
        return data;
    }

    async importData(data) {
        try {
            if (data.expenses) {
                await this.set(this.storageKeys.EXPENSES, data.expenses);
            }
            if (data.budget) {
                await this.set(this.storageKeys.BUDGET, data.budget);
            }
            if (data.settings) {
                await this.set(this.storageKeys.SETTINGS, data.settings);
            }
            if (data.categories) {
                await this.set(this.storageKeys.CATEGORIES, data.categories);
            }
            return true;
        } catch (error) {
            console.error('Import error:', error);
            return false;
        }
    }

    // Utility functions
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    formatCurrency(amount, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    // CSV Export
    async exportToCSV() {
        const expenses = await this.getExpenses();
        const categories = await this.get(this.storageKeys.CATEGORIES) || [];
        
        const categoryMap = {};
        categories.forEach(cat => {
            categoryMap[cat.id] = cat.name;
        });
        
        const csvHeaders = ['Date', 'Description', 'Category', 'Amount'];
        const csvRows = expenses.map(exp => [
            exp.date,
            exp.description,
            categoryMap[exp.category] || exp.category,
            exp.amount
        ]);
        
        const csvContent = [csvHeaders, ...csvRows]
            .map(row => row.map(field => `"${field}"`).join(','))
            .join('\n');
        
        return csvContent;
    }
}

// Create global instance
window.storageManager = new StorageManager();