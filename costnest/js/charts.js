// Chart Management for CostNest
class ChartManager {
    constructor() {
        this.charts = {};
        this.isChartJSReady = false;
        this.chartColors = {
            'food': '#FF6B6B',
            'shopping': '#4ECDC4',
            'entertainment': '#45B7D1',
            'transport': '#96CEB4',
            'bills': '#FFEAA7',
            'health': '#DDA0DD',
            'other': '#A8A8A8'
        };
        this.initializationAttempts = 0;
        this.maxAttempts = 15; // Increased attempts
        this.chartsInitialized = false;
        // Don't automatically initialize charts in constructor
        console.log('ChartManager created, waiting for explicit initialization');
    }

    async waitForChartJS() {
        return new Promise((resolve, reject) => {
            const checkChart = () => {
                this.initializationAttempts++;
                
                if (typeof Chart !== 'undefined' && Chart.Chart) {
                    this.isChartJSReady = true;
                    console.log('Chart.js is ready and available');
                    resolve();
                } else if (this.initializationAttempts >= this.maxAttempts) {
                    console.warn(`Chart.js not loaded after ${this.maxAttempts} attempts, charts will be disabled`);
                    reject(new Error('Chart.js failed to load after multiple attempts'));
                } else {
                    console.log(`Waiting for Chart.js... attempt ${this.initializationAttempts}/${this.maxAttempts}`);
                    setTimeout(checkChart, 300); // Increased interval
                }
            };
            checkChart();
        });
    }

    ensureChartJS() {
        if (typeof Chart === 'undefined' || !Chart.Chart) {
            console.error('Chart.js is not available. Charts will not be displayed.');
            return false;
        }
        return true;
    }

    async safeInitializeCharts() {
        if (this.chartsInitialized) {
            console.log('Charts already initialized');
            return true;
        }

        try {
            await this.waitForChartJS();
            await this.initializeCharts();
            this.chartsInitialized = true;
            console.log('Charts initialized successfully');
            return true;
        } catch (error) {
            console.warn('Chart initialization failed, charts will be disabled:', error.message);
            return false;
        }
    }

    async initializeCharts() {
        await this.createExpenseChart();
        this.setupChartEventListeners();
    }

    setupChartEventListeners() {
        // Chart type toggle (if we add this feature)
        // Chart period selector (if we add this feature)
    }

    async createExpenseChart() {
        const canvas = document.getElementById('expense-chart');
        if (!canvas) {
            console.warn('Expense chart canvas not found');
            return;
        }

        if (!this.ensureChartJS()) {
            console.error('Cannot create chart: Chart.js is not available');
            // Show a fallback message in the chart container
            const chartContainer = canvas.parentElement;
            if (chartContainer) {
                chartContainer.innerHTML = '<div style="color: #ffffff; text-align: center; padding: 40px; font-family: Bungee, cursive;">Charts unavailable<br><small>Chart.js failed to load</small></div>';
            }
            return;
        }

        const ctx = canvas.getContext('2d');
        
        // Get chart data
        const chartData = await this.getChartData();
        
        // Destroy existing chart if it exists
        if (this.charts.expenseChart) {
            this.charts.expenseChart.destroy();
        }

        this.charts.expenseChart = new Chart(ctx, {
            type: 'bar',
            data: chartData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y', // Horizontal bar chart
                plugins: {
                    legend: {
                        display: false // Hide legend for bar chart
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        titleFont: {
                            family: 'Bungee',
                            size: 12
                        },
                        bodyFont: {
                            family: 'Bungee',
                            size: 11
                        },
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed.x;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${label}: $${value.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            borderColor: 'rgba(255, 255, 255, 0.2)'
                        },
                        ticks: {
                            color: '#ffffff',
                            font: {
                                family: 'Bungee',
                                size: 10
                            },
                            callback: function(value) {
                                return '$' + value.toFixed(0);
                            }
                        }
                    },
                    y: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#ffffff',
                            font: {
                                family: 'Bungee',
                                size: 11
                            },
                            maxRotation: 0,
                            padding: 10
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                layout: {
                    padding: {
                        top: 10,
                        bottom: 10,
                        left: 10,
                        right: 10
                    }
                }
            }
        });
    }

    async getChartData() {
        const categoryTotals = await window.storageManager.getCategoryTotals();
        const categories = await window.storageManager.get(window.storageManager.storageKeys.CATEGORIES) || [];
        
        if (Object.keys(categoryTotals).length === 0) {
            // No data available
            return {
                labels: ['No expenses yet'],
                datasets: [{
                    data: [1],
                    backgroundColor: ['rgba(255, 255, 255, 0.1)'],
                    borderColor: ['rgba(255, 255, 255, 0.2)'],
                    borderWidth: 1
                }]
            };
        }

        const labels = [];
        const data = [];
        const backgroundColor = [];
        const borderColor = [];

        // Sort categories by amount (highest first)
        const sortedCategories = Object.entries(categoryTotals)
            .sort(([,a], [,b]) => b - a);

        sortedCategories.forEach(([categoryId, amount]) => {
            const category = categories.find(cat => cat.id === categoryId);
            const categoryName = category ? category.name : categoryId;
            const color = this.chartColors[categoryId] || '#A8A8A8';
            
            labels.push(categoryName);
            data.push(amount);
            backgroundColor.push(color);
            borderColor.push(this.lightenColor(color, 20));
        });

        return {
            labels,
            datasets: [{
                data,
                backgroundColor,
                borderColor,
                borderWidth: 2,
                hoverBackgroundColor: backgroundColor.map(color => this.lightenColor(color, 10)),
                hoverBorderColor: borderColor,
                hoverBorderWidth: 3
            }]
        };
    }

    async createTrendChart() {
        // Create a line chart showing spending trends over time
        const canvas = document.getElementById('trend-chart');
        if (!canvas) return;

        if (!this.ensureChartJS()) {
            console.error('Cannot create trend chart: Chart.js is not available');
            return;
        }

        const ctx = canvas.getContext('2d');
        const trendData = await this.getTrendData();

        if (this.charts.trendChart) {
            this.charts.trendChart.destroy();
        }

        this.charts.trendChart = new Chart(ctx, {
            type: 'line',
            data: trendData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        cornerRadius: 8
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    y: {
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            callback: function(value) {
                                return '$' + value.toFixed(0);
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                },
                elements: {
                    line: {
                        tension: 0.4,
                        borderWidth: 3,
                        borderColor: '#4ECDC4',
                        backgroundColor: 'rgba(78, 205, 196, 0.1)'
                    },
                    point: {
                        radius: 4,
                        hoverRadius: 6,
                        backgroundColor: '#4ECDC4',
                        borderColor: '#ffffff',
                        borderWidth: 2
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    async getTrendData() {
        const expenses = await window.storageManager.getExpenses();
        const last30Days = [];
        const dailyTotals = {};

        // Generate last 30 days
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateString = date.toISOString().split('T')[0];
            last30Days.push(dateString);
            dailyTotals[dateString] = 0;
        }

        // Calculate daily totals
        expenses.forEach(expense => {
            if (dailyTotals.hasOwnProperty(expense.date)) {
                dailyTotals[expense.date] += parseFloat(expense.amount);
            }
        });

        const labels = last30Days.map(date => {
            const d = new Date(date);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        });

        const data = last30Days.map(date => dailyTotals[date]);

        return {
            labels,
            datasets: [{
                label: 'Daily Spending',
                data,
                fill: true,
                borderColor: '#4ECDC4',
                backgroundColor: 'rgba(78, 205, 196, 0.1)',
                tension: 0.4
            }]
        };
    }

    async createBudgetChart() {
        // Create a progress chart showing budget usage
        const canvas = document.getElementById('budget-chart');
        if (!canvas) return;

        if (!this.ensureChartJS()) {
            console.error('Cannot create budget chart: Chart.js is not available');
            return;
        }

        const ctx = canvas.getContext('2d');
        const budget = await window.storageManager.getBudget();
        const monthlyTotal = await window.storageManager.getMonthlyTotal();

        if (!budget) return;

        const percentage = Math.min((monthlyTotal / budget.amount) * 100, 100);
        const remaining = Math.max(budget.amount - monthlyTotal, 0);

        if (this.charts.budgetChart) {
            this.charts.budgetChart.destroy();
        }

        this.charts.budgetChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Budget Usage'],
                datasets: [
                    {
                        label: 'Spent',
                        data: [monthlyTotal],
                        backgroundColor: percentage > 80 ? '#FF6B6B' : '#4ECDC4',
                        borderColor: percentage > 80 ? '#FF5252' : '#26C6DA',
                        borderWidth: 2
                    },
                    {
                        label: 'Remaining', 
                        data: [remaining],
                        backgroundColor: 'rgba(255, 255, 255, 0.2)',
                        borderColor: 'rgba(255, 255, 255, 0.3)',
                        borderWidth: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        display: true,
                        position: 'bottom',
                        labels: {
                            color: '#ffffff',
                            font: {
                                family: 'Bungee',
                                size: 10
                            },
                            padding: 15,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        cornerRadius: 8,
                        titleFont: {
                            family: 'Bungee',
                            size: 12
                        },
                        bodyFont: {
                            family: 'Bungee',
                            size: 11
                        },
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed.x;
                                const total = budget.amount;
                                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                                return `${context.dataset.label}: $${value.toFixed(2)} (${percentage}%)`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        max: budget.amount,
                        stacked: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            borderColor: 'rgba(255, 255, 255, 0.2)'
                        },
                        ticks: {
                            color: '#ffffff',
                            font: {
                                family: 'Bungee',
                                size: 10
                            },
                            callback: function(value) {
                                return '$' + value.toFixed(0);
                            }
                        }
                    },
                    y: {
                        stacked: true,
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#ffffff',
                            font: {
                                family: 'Bungee',
                                size: 11
                            }
                        }
                    }
                },
                animation: {
                    duration: 1000,
                    easing: 'easeOutQuart'
                },
                layout: {
                    padding: {
                        top: 10,
                        bottom: 10,
                        left: 10,
                        right: 10
                    }
                }
            }
        });
    }

    async updateCharts() {
        // Ensure charts are properly initialized before updating
        const initialized = await this.safeInitializeCharts();
        if (!initialized) {
            console.log('Charts not available, skipping update');
            return;
        }

        await this.createExpenseChart();
        // Update other charts if they exist
        if (document.getElementById('trend-chart')) {
            await this.createTrendChart();
        }
        if (document.getElementById('budget-chart')) {
            await this.createBudgetChart();
        }
    }

    // Utility functions
    lightenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt;
        const G = (num >> 8 & 0x00FF) + amt;
        const B = (num & 0x0000FF) + amt;
        return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }

    darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return '#' + (0x1000000 + (R > 255 ? 255 : R < 0 ? 0 : R) * 0x10000 +
            (G > 255 ? 255 : G < 0 ? 0 : G) * 0x100 +
            (B > 255 ? 255 : B < 0 ? 0 : B)).toString(16).slice(1);
    }

    // Export chart as image
    exportChart(chartName) {
        const chart = this.charts[chartName];
        if (!chart) return null;

        const canvas = chart.canvas;
        const url = canvas.toDataURL('image/png');
        
        // Create download link
        const link = document.createElement('a');
        link.download = `costnest-${chartName}-${new Date().toISOString().split('T')[0]}.png`;
        link.href = url;
        link.click();
        
        return url;
    }

    // Resize charts when container changes
    resizeCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.resize === 'function') {
                chart.resize();
            }
        });
    }

    // Destroy all charts
    destroyCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts = {};
    }
}

// Initialize chart manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Give more time for all scripts including Chart.js to load
    setTimeout(() => {
        try {
            window.chartManager = new ChartManager();
            console.log('ChartManager created successfully');
            
            // Initialize charts immediately if Chart.js is already available
            if (typeof Chart !== 'undefined' && Chart.Chart) {
                window.chartManager.safeInitializeCharts();
            }
        } catch (error) {
            console.error('Failed to create ChartManager:', error);
        }
    }, 500); // Increased delay to 500ms
    
    // Update charts when window is resized
    window.addEventListener('resize', () => {
        if (window.chartManager && window.chartManager.chartsInitialized) {
            window.chartManager.resizeCharts();
        }
    });
});