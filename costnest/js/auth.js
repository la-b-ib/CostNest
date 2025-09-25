// Authentication Management for CostNest
class AuthManager {
    constructor() {
        this.currentPIN = '';
        this.maxPINLength = 4;
        this.isAuthenticated = false;
        this.lockTimeout = 5 * 60 * 1000; // 5 minutes
        this.lockTimer = null;
        this.initializeAuth();
    }

    async initializeAuth() {
        // Check if user has a PIN set up
        const hasPIN = await window.storageManager.hasPIN();
        
        if (!hasPIN) {
            // No PIN set - go directly to main screen (PIN is optional)
            this.isAuthenticated = true;
            this.showMainScreen();
        } else {
            // PIN is set - show PIN entry screen
            this.showPINEntryMode();
        }
        
        this.setupEventListeners();
        this.startLockTimer();
    }

    setupEventListeners() {
        // PIN keypad event listeners
        document.querySelectorAll('.pin-btn[data-digit]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const digit = e.target.getAttribute('data-digit');
                this.addDigit(digit);
            });
        });

        // Clear button
        document.querySelector('.pin-btn[data-action="clear"]').addEventListener('click', () => {
            this.clearLastDigit();
        });

        // Enter button
        document.querySelector('.pin-btn[data-action="enter"]').addEventListener('click', () => {
            this.submitPIN();
        });

        // Setup PIN button
        safeAddEventListener('setup-pin-btn', 'click', () => {
            this.showSetupPINMode();
        });

        // Lock button
        safeAddEventListener('lock-btn', 'click', () => {
            this.lockApp();
        });

        // Auto-lock on inactivity
        document.addEventListener('click', () => this.resetLockTimer());
        document.addEventListener('keypress', () => this.resetLockTimer());
    }

    addDigit(digit) {
        if (this.currentPIN.length < this.maxPINLength) {
            this.currentPIN += digit;
            this.updatePINDots();
            this.addHapticFeedback();
            
            // Auto-submit when PIN is complete
            if (this.currentPIN.length === this.maxPINLength) {
                setTimeout(() => this.submitPIN(), 200);
            }
        }
    }

    clearLastDigit() {
        if (this.currentPIN.length > 0) {
            this.currentPIN = this.currentPIN.slice(0, -1);
            this.updatePINDots();
            this.addHapticFeedback();
        }
    }

    clearPIN() {
        this.currentPIN = '';
        this.updatePINDots();
    }

    updatePINDots() {
        const dots = document.querySelectorAll('.pin-dot');
        dots.forEach((dot, index) => {
            if (index < this.currentPIN.length) {
                dot.classList.add('filled');
            } else {
                dot.classList.remove('filled');
            }
        });
    }

    async submitPIN() {
        if (this.currentPIN.length !== this.maxPINLength) {
            this.showError('Please enter a 4-digit PIN');
            return;
        }

        const subtitleText = document.querySelector('.pin-card .subtitle').textContent;
        const setupMode = subtitleText.includes('Set up') || subtitleText.includes('Confirm');
        console.log('Submit PIN - Setup mode:', setupMode, 'Subtitle:', subtitleText);
        
        if (setupMode) {
            await this.handlePINSetup();
        } else {
            await this.handlePINVerification();
        }
    }

    async handlePINSetup() {
        console.log('PIN Setup - tempPIN:', this.tempPIN, 'currentPIN:', this.currentPIN);
        
        if (!this.tempPIN) {
            // First PIN entry
            this.tempPIN = this.currentPIN;
            this.clearPIN();
            this.updateSetupMessage('Confirm your PIN');
            console.log('PIN Setup - First entry, tempPIN set to:', this.tempPIN);
        } else {
            // PIN confirmation
            console.log('PIN Setup - Comparing:', this.tempPIN, '===', this.currentPIN);
            if (this.tempPIN === this.currentPIN) {
                // PINs match, save it
                console.log('PIN Setup - PINs match, saving...');
                const success = await window.storageManager.setPIN(this.currentPIN);
                if (success) {
                    this.isAuthenticated = true;
                    this.showSuccess('PIN set successfully!');
                    setTimeout(() => this.showMainScreen(), 1000);
                } else {
                    this.showError('Failed to save PIN. Please try again.');
                }
            } else {
                // PINs don't match
                console.log('PIN Setup - PINs do not match');
                this.showError('PINs do not match. Please try again.');
                this.tempPIN = null;
                this.clearPIN();
                this.updateSetupMessage('Set up your 4-digit PIN');
            }
        }
    }

    async handlePINVerification() {
        const isValid = await window.storageManager.verifyPIN(this.currentPIN);
        
        if (isValid) {
            this.isAuthenticated = true;
            this.showSuccess('Welcome back!');
            setTimeout(() => this.showMainScreen(), 800);
        } else {
            this.showError('Incorrect PIN. Please try again.');
            this.clearPIN();
            this.shakeAnimation();
        }
    }

    showSetupPINMode() {
        this.tempPIN = null;
        this.clearPIN();
        this.updateSetupMessage('Set up your 4-digit PIN');
        document.querySelector('.setup-pin-link').style.display = 'none';
    }

    showPINEntryMode() {
        this.clearPIN();
        this.updateSetupMessage('Enter your PIN');
        document.querySelector('.setup-pin-link').style.display = 'block';
    }

    showChangePINMode() {
        // First verify current PIN, then allow setting new one
        this.changePINStep = 'verify';
        this.lockApp();
        this.updateSetupMessage('Enter current PIN');
    }

    updateSetupMessage(message) {
        document.querySelector('.pin-card .subtitle').textContent = message;
    }

    showMainScreen() {
        document.getElementById('pin-screen').classList.remove('active');
        document.getElementById('main-screen').classList.add('active');
        this.resetLockTimer();
    }

    lockApp() {
        this.isAuthenticated = false;
        this.clearPIN();
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        document.getElementById('pin-screen').classList.add('active');
        this.showPINEntryMode();
    }

    startLockTimer() {
        this.lockTimer = setTimeout(() => {
            if (this.isAuthenticated) {
                this.lockApp();
                this.showNotification('App locked due to inactivity');
            }
        }, this.lockTimeout);
    }

    resetLockTimer() {
        if (this.lockTimer) {
            clearTimeout(this.lockTimer);
        }
        if (this.isAuthenticated) {
            this.startLockTimer();
        }
    }

    addHapticFeedback() {
        // Vibration feedback for mobile devices
        if ('vibrate' in navigator) {
            navigator.vibrate(50);
        }
        
        // Visual feedback
        const activeBtn = event.target;
        activeBtn.style.transform = 'scale(0.95)';
        setTimeout(() => {
            activeBtn.style.transform = '';
        }, 100);
    }

    shakeAnimation() {
        const pinCard = document.querySelector('.pin-card');
        pinCard.style.animation = 'shake 0.5s ease-in-out';
        setTimeout(() => {
            pinCard.style.animation = '';
        }, 500);
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        this.showNotification(message, 'success');
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
        }, 3000);
    }

    // Biometric authentication (future enhancement)
    async requestBiometricAuth() {
        if ('credentials' in navigator && 'create' in navigator.credentials) {
            try {
                // WebAuthn implementation for biometric auth
                // This is a placeholder for future biometric integration
                console.log('Biometric authentication not yet implemented');
            } catch (error) {
                console.error('Biometric auth error:', error);
            }
        }
    }

    // Security utilities
    generateSecureRandom() {
        const array = new Uint32Array(1);
        crypto.getRandomValues(array);
        return array[0];
    }

    async deriveKey(password, salt) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        
        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: encoder.encode(salt),
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }
}

// Add shake animation CSS
const shakeCSS = `
@keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
}
`;

const style = document.createElement('style');
style.textContent = shakeCSS;
document.head.appendChild(style);

// Initialize auth manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.authManager = new AuthManager();
});