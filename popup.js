// Helper wrappers for chrome.storage as Promises
function chromeStorageGet(keys) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(keys, (result) => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve(result);
      });
    });
  }
  
  function chromeStorageSet(data) {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set(data, () => {
        if (chrome.runtime.lastError) reject(chrome.runtime.lastError);
        else resolve();
      });
    });
  }
  
  // Debounce helper to optimize filtering
  function debounce(func, delay) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => func.apply(this, args), delay);
    };
  }
  
  // Global Configuration and Variables
  const DEFAULT_PIN = "1234";
  const AUTO_LOCK_DELAY = 60000; // 60 seconds autoplock
  const colorPalette = [
    "#f44336", "#e91e63", "#9c27b0", "#673ab7", "#3f51b5",
    "#2196f3", "#03a9f4", "#00bcd4", "#009688", "#4caf50",
    "#8bc34a", "#cddc39", "#ffeb3b", "#ffc107", "#ff9800", "#ff5722"
  ];
  let expenses = [];
  let editIndex = null; // null => new expense; number indicates edit index
  let pieChart, lineChart;
  let autoLockTimer;
  let monthlyBudget = 0; // will be loaded from storage
  
  document.addEventListener("DOMContentLoaded", function () {
    // Initialize Materialize components: Tabs, Datepicker, Select, and Modals
    M.Tabs.init(document.querySelectorAll(".tabs"));
    M.Datepicker.init(document.querySelectorAll(".datepicker"), {
      format: "yyyy-mm-dd",
      defaultDate: new Date(),
      setDefaultDate: true
    });
    M.FormSelect.init(document.querySelectorAll("select"));
    M.Modal.init(document.querySelectorAll(".modal"));
  
    // DOM Elements for PIN Lock
    const lockScreen = document.getElementById("lock-screen");
    const pinInput = document.getElementById("pin-input");
    const pinSubmit = document.getElementById("pin-submit");
    const pinError = document.getElementById("pin-error");
  
    // DOM Elements for Main Screen
    const mainScreen = document.getElementById("main-screen");
    const itemForm = document.getElementById("item-form");
    const itemList = document.getElementById("item-list");
    const totalSpendingElem = document.getElementById("total-spending");
    const filterInput = document.getElementById("filter-input");
    const sortSelect = document.getElementById("sort-select");
    const darkModeToggle = document.getElementById("dark-mode-toggle");
    const exportCsvButton = document.getElementById("export-csv");
    const backupDataButton = document.getElementById("backup-data");
    const restoreDataButton = document.getElementById("restore-data");
    const restoreFileInput = document.getElementById("restore-file-input");
    const changePinButton = document.getElementById("change-pin");
    const lockBackButton = document.getElementById("lock-back");
    const clearAllButton = document.getElementById("clear-all");
    const setBudgetButton = document.getElementById("set-budget");
    
    // Modals
    const clearAllModalElem = document.getElementById("clear-all-modal");
    const clearAllModal = M.Modal.getInstance(clearAllModalElem);
    const budgetModalElem = document.getElementById("budget-modal");
    const budgetModal = M.Modal.getInstance(budgetModalElem);
    
    // Elements for add/edit expense form
    const expenseSubmitBtn = document.getElementById("expense-submit-btn");
    const expenseSubmitText = document.getElementById("expense-submit-text");
    const expenseCancelBtn = document.getElementById("expense-cancel-btn");
  
    // Chart contexts
    const pieCtx = document.getElementById("expense-pie-chart").getContext("2d");
    const lineCtx = document.getElementById("expense-line-chart").getContext("2d");
  
    // Budget UI elements
    const budgetProgressBar = document.getElementById("budget-progress-bar");
    const monthlyBudgetElem = document.getElementById("monthly-budget");
    const budgetSpentElem = document.getElementById("budget-spent");
    const budgetInput = document.getElementById("budget-input");
  
    // ------------------------------
    // Auto-lock Implementation
    // ------------------------------
    function resetAutoLockTimer() {
      clearTimeout(autoLockTimer);
      autoLockTimer = setTimeout(() => {
        // Auto-lock the extension
        mainScreen.style.display = "none";
        lockScreen.style.display = "block";
      }, AUTO_LOCK_DELAY);
    }
    // Reset auto-lock timer on user interactions in the main screen.
    mainScreen.addEventListener("mousemove", resetAutoLockTimer);
    mainScreen.addEventListener("keydown", resetAutoLockTimer);
    mainScreen.addEventListener("click", resetAutoLockTimer);
  
    // ------------------------------
    // PIN Lock System
    // ------------------------------
    async function getSavedPin() {
      const result = await chromeStorageGet(["costnestPin"]);
      if (result.costnestPin) return result.costnestPin;
      await chromeStorageSet({ costnestPin: DEFAULT_PIN });
      return DEFAULT_PIN;
    }
  
    pinSubmit.addEventListener("click", async function () {
      const enteredPin = pinInput.value;
      const savedPin = await getSavedPin();
      if (enteredPin === savedPin) {
        lockScreen.style.display = "none";
        mainScreen.style.display = "block";
        resetAutoLockTimer();
        pinError.textContent = "";
        pinInput.value = "";
        loadExpenses();
        loadMonthlyBudget();
      } else {
        pinError.textContent = "Incorrect PIN. Please try again.";
      }
    });
  
    lockBackButton.addEventListener("click", function () {
      mainScreen.style.display = "none";
      lockScreen.style.display = "block";
    });
  
    changePinButton.addEventListener("click", async function () {
      const currentPin = prompt("Enter current PIN:");
      const savedPin = await getSavedPin();
      if (currentPin === savedPin) {
        let newPin = prompt("Enter new 4-digit PIN:");
        if (newPin && newPin.length === 4 && /^\d+$/.test(newPin)) {
          await chromeStorageSet({ costnestPin: newPin });
          alert("PIN changed successfully!");
        } else {
          alert("Invalid PIN. Please enter a 4-digit number.");
        }
      } else {
        alert("Incorrect current PIN.");
      }
    });
  
    // ------------------------------
    // Expense Tracking Functionality
    // ------------------------------
    itemForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const name = document.getElementById("item-name").value.trim();
      const cost = parseFloat(document.getElementById("item-cost").value.trim());
      const category = document.getElementById("item-category").value.trim();
      const date = document.getElementById("item-date").value.trim();
      if (name && !isNaN(cost) && category && date) {
        const expense = { name, cost, category, date };
        if (editIndex !== null) {
          expenses[editIndex] = expense;
          editIndex = null;
          expenseSubmitText.textContent = "Add Expense";
          expenseSubmitBtn.querySelector("i").textContent = "add";
          expenseCancelBtn.style.display = "none";
        } else {
          expenses.push(expense);
        }
        // Always sort expenses according to currently chosen sort
        applySort();
        await saveExpenses();
        updateExpenseList();
        updateTotalSpending();
        updateCharts();
        updateBudgetProgress();
        itemForm.reset();
        M.updateTextFields();
        M.Datepicker.getInstance(document.getElementById("item-date")).setDate(new Date());
      }
    });
  
    expenseCancelBtn.addEventListener("click", function () {
      editIndex = null;
      expenseSubmitText.textContent = "Add Expense";
      expenseSubmitBtn.querySelector("i").textContent = "add";
      expenseCancelBtn.style.display = "none";
      itemForm.reset();
      M.updateTextFields();
    });
  
    // ------------------------------
    // Filtering with Debounce & Sorting
    // ------------------------------
    filterInput.addEventListener("input", debounce(updateExpenseList, 300));
    sortSelect.addEventListener("change", function () {
      applySort();
      updateExpenseList();
    });
  
    function applySort() {
      const sortBy = sortSelect.value;
      if (sortBy === "date-asc") {
        expenses.sort((a, b) => new Date(a.date) - new Date(b.date));
      } else if (sortBy === "date-desc") {
        expenses.sort((a, b) => new Date(b.date) - new Date(a.date));
      } else if (sortBy === "cost-asc") {
        expenses.sort((a, b) => a.cost - b.cost);
      } else if (sortBy === "cost-desc") {
        expenses.sort((a, b) => b.cost - a.cost);
      } else if (sortBy === "category-asc") {
        expenses.sort((a, b) => a.category.localeCompare(b.category));
      } else if (sortBy === "category-desc") {
        expenses.sort((a, b) => b.category.localeCompare(a.category));
      }
    }
  
    // ------------------------------
    // Backup and Restore Functionality
    // ------------------------------
    backupDataButton.addEventListener("click", function () {
      if (expenses.length === 0) {
        alert("No data to backup!");
        return;
      }
      const dataStr = JSON.stringify(expenses, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "costnest_backup.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  
    restoreDataButton.addEventListener("click", function () {
      restoreFileInput.click();
    });
  
    restoreFileInput.addEventListener("change", function (e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async function (evt) {
        try {
          const importedData = JSON.parse(evt.target.result);
          if (Array.isArray(importedData)) {
            expenses = importedData;
            await saveExpenses();
            updateExpenseList();
            updateTotalSpending();
            updateCharts();
            updateBudgetProgress();
            alert("Data restored successfully!");
          } else {
            alert("Invalid data format.");
          }
        } catch (err) {
          alert("Error reading file.");
        }
      };
      reader.readAsText(file);
      restoreFileInput.value = "";
    });
  
    // ------------------------------
    // CSV Export Functionality
    // ------------------------------
    exportCsvButton.addEventListener("click", function () {
      if (expenses.length === 0) {
        alert("No expenses to export.");
        return;
      }
      let csvContent = "data:text/csv;charset=utf-8,Item Name,Cost,Category,Date\n";
      expenses.forEach((item) => {
        csvContent += `${item.name},${item.cost},${item.category},${item.date}\n`;
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "costnest_expenses.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  
    // ------------------------------
    // Data Persistence Functions
    // ------------------------------
    async function saveExpenses() {
      await chromeStorageSet({ costnestExpenses: expenses });
    }
  
    async function loadExpenses() {
      const result = await chromeStorageGet(["costnestExpenses"]);
      if (result.costnestExpenses) {
        expenses = result.costnestExpenses;
      }
      applySort();
      updateExpenseList();
      updateTotalSpending();
      updateCharts();
      updateBudgetProgress();
    }
    
    // ------------------------------
    // Monthly Budget Persistence
    // ------------------------------
    async function loadMonthlyBudget() {
      const result = await chromeStorageGet(["monthlyBudget"]);
      if (result.monthlyBudget) {
        monthlyBudget = parseFloat(result.monthlyBudget);
      } else {
        monthlyBudget = 0;
      }
      monthlyBudgetElem.textContent = monthlyBudget.toFixed(2);
      updateBudgetProgress();
    }
  
    async function saveMonthlyBudget(budget) {
      monthlyBudget = parseFloat(budget);
      await chromeStorageSet({ monthlyBudget: monthlyBudget });
      monthlyBudgetElem.textContent = monthlyBudget.toFixed(2);
      updateBudgetProgress();
    }
  
    // ------------------------------
    // UI Update Functions: Expense List, Charts, & Total
    // ------------------------------
    function updateExpenseList() {
      const filter = filterInput.value.toLowerCase();
      itemList.innerHTML = "";
      expenses.forEach((item, index) => {
        // Apply filter
        if (item.name.toLowerCase().includes(filter) || item.category.toLowerCase().includes(filter)) {
          const li = document.createElement("li");
          li.className = "collection-item";
          const displayDate = new Date(item.date).toLocaleDateString();
          li.innerHTML = `<strong>${item.name}</strong> | ${item.category} | $${item.cost.toFixed(2)} | <em>${displayDate}</em>`;
          
          // Edit Button
          const editBtn = document.createElement("button");
          editBtn.className = "btn-small blue right";
          editBtn.style.marginLeft = "5px";
          editBtn.innerHTML = `<i class="material-icons">edit</i>`;
          editBtn.addEventListener("click", function () {
            document.getElementById("item-name").value = item.name;
            document.getElementById("item-cost").value = item.cost;
            document.getElementById("item-category").value = item.category;
            document.getElementById("item-date").value = item.date;
            M.updateTextFields();
            editIndex = index;
            expenseSubmitText.textContent = "Update Expense";
            expenseSubmitBtn.querySelector("i").textContent = "edit";
            expenseCancelBtn.style.display = "inline-block";
            // Ensure Expenses tab is active
            M.Tabs.getInstance(document.querySelector(".tabs")).select("expenses-tab");
          });
          
          // Delete Button
          const delBtn = document.createElement("button");
          delBtn.className = "btn-small red right";
          delBtn.innerHTML = `<i class="material-icons">delete</i>`;
          delBtn.addEventListener("click", async function () {
            if (confirm("Delete this expense?")) {
              expenses.splice(index, 1);
              await saveExpenses();
              updateExpenseList();
              updateTotalSpending();
              updateCharts();
              updateBudgetProgress();
            }
          });
          li.appendChild(editBtn);
          li.appendChild(delBtn);
          itemList.appendChild(li);
        }
      });
    }
  
    function updateTotalSpending() {
      const total = expenses.reduce((sum, item) => sum + item.cost, 0);
      totalSpendingElem.textContent = total.toFixed(2);
    }
  
    // Update Pie and Line Charts
    function updateCharts() {
      // --- Pie Chart: Expenses by Category ---
      const categoryTotals = {};
      expenses.forEach(item => {
        categoryTotals[item.category] = (categoryTotals[item.category] || 0) + item.cost;
      });
      const pieLabels = Object.keys(categoryTotals);
      const pieData = Object.values(categoryTotals);
      const pieColors = pieLabels.map((_, idx) => colorPalette[idx % colorPalette.length]);
  
      if (pieChart) {
        pieChart.data.labels = pieLabels;
        pieChart.data.datasets[0].data = pieData;
        pieChart.data.datasets[0].backgroundColor = pieColors;
        pieChart.update();
      } else {
        pieChart = new Chart(pieCtx, {
          type: 'pie',
          data: {
            labels: pieLabels,
            datasets: [{
              label: 'Expenses by Category',
              data: pieData,
              backgroundColor: pieColors,
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            plugins: { legend: { position: 'top' } }
          }
        });
      }
  
      // --- Line Chart: Monthly Spending Trend ---
      const monthlyTotals = {};
      expenses.forEach(item => {
        const d = new Date(item.date);
        const key = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2, '0')}`;
        monthlyTotals[key] = (monthlyTotals[key] || 0) + item.cost;
      });
      const sortedKeys = Object.keys(monthlyTotals).sort();
      const lineLabels = sortedKeys.map(key => {
        const [year, month] = key.split("-");
        const date = new Date(year, month - 1);
        return date.toLocaleString('default', { month: 'short', year: 'numeric' });
      });
      const lineData = sortedKeys.map(key => monthlyTotals[key]);
  
      if (lineChart) {
        lineChart.data.labels = lineLabels;
        lineChart.data.datasets[0].data = lineData;
        lineChart.update();
      } else {
        lineChart = new Chart(lineCtx, {
          type: 'line',
          data: {
            labels: lineLabels,
            datasets: [{
              label: 'Monthly Spending',
              data: lineData,
              fill: false,
              borderColor: "#2196f3",
              tension: 0.1
            }]
          },
          options: {
            responsive: true,
            scales: { y: { beginAtZero: true } }
          }
        });
      }
    }
  
    // ------------------------------
    // Monthly Budget Progress Update
    // ------------------------------
    function updateBudgetProgress() {
      // Calculate spending for the current month
      const now = new Date();
      const currentMonthKey = `${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2, '0')}`;
      let monthlySpent = expenses.filter(item => {
        const itemDate = new Date(item.date);
        const key = `${itemDate.getFullYear()}-${(itemDate.getMonth()+1).toString().padStart(2, '0')}`;
        return key === currentMonthKey;
      }).reduce((sum, item) => sum + item.cost, 0);
      budgetSpentElem.textContent = monthlySpent.toFixed(2);
      // Update progress bar if budget is set (> 0)
      if (monthlyBudget > 0) {
        let percent = Math.min(100, (monthlySpent / monthlyBudget) * 100);
        budgetProgressBar.style.width = percent + "%";
      } else {
        budgetProgressBar.style.width = "0%";
      }
    }
  
    // ------------------------------
    // Settings: Clear All Expenses & Set Monthly Budget
    // ------------------------------
    clearAllButton.addEventListener("click", function () {
      clearAllModal.open();
    });
  
    document.getElementById("confirm-clear-all").addEventListener("click", async function () {
      expenses = [];
      await saveExpenses();
      updateExpenseList();
      updateTotalSpending();
      updateCharts();
      updateBudgetProgress();
    });
  
    setBudgetButton.addEventListener("click", function () {
      budgetModal.open();
    });
  
    document.getElementById("save-budget").addEventListener("click", function () {
      const newBudget = budgetInput.value;
      if (newBudget && !isNaN(newBudget) && parseFloat(newBudget) >= 0) {
        saveMonthlyBudget(newBudget);
        budgetInput.value = "";
      } else {
        alert("Please enter a valid budget amount.");
      }
    });
  });
  