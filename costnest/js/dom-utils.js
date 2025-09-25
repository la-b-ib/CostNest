// DOM utilities for CostNest - Safe element access
(function() {
    'use strict';
    
    // Safe element getter with null check
    window.safeGetElement = function(id) {
        try {
            return document.getElementById(id);
        } catch (error) {
            console.warn(`Element with id '${id}' not found:`, error);
            return null;
        }
    };
    
    // Safe event listener with null check
    window.safeAddEventListener = function(elementId, event, handler) {
        try {
            const element = window.safeGetElement(elementId);
            if (element) {
                element.addEventListener(event, handler);
                return true;
            } else {
                console.warn(`Cannot add event listener: element '${elementId}' not found`);
                return false;
            }
        } catch (error) {
            console.error(`Error adding event listener to '${elementId}':`, error);
            return false;
        }
    };
    
    // Extension context validation
    window.validateExtensionContext = function() {
        try {
            if (chrome && chrome.runtime && chrome.runtime.id) {
                return true;
            }
            throw new Error('Extension context invalidated');
        } catch (error) {
            console.error('Extension context error:', error);
            return false;
        }
    };
})();