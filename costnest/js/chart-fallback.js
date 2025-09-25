// Chart.js fallback loader for CostNest
// This script handles loading Chart.js from CDN if the local file fails

(function() {
    'use strict';
    
    // Check if Chart.js loaded successfully from local file
    if (typeof Chart === 'undefined') {
        console.warn('Local Chart.js failed to load, falling back to CDN');
        
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js';
        
        script.onload = function() {
            console.log('Chart.js loaded from CDN successfully');
            // Charts will be initialized when needed via safeInitializeCharts()
        };
        
        script.onerror = function() {
            console.error('Failed to load Chart.js from CDN, charts will be disabled');
        };
        
        document.head.appendChild(script);
    } else {
        console.log('Chart.js loaded successfully from local file');
    }
})();