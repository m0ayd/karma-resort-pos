// js/modules/security.js

import * as db from './db.js';
import { STORES } from './db.js';
import { showToast } from '../utils.js';

let idleTimer = null;
const screenLockOverlay = document.getElementById('screen-lock-overlay');
const cashierPasswordInput = document.getElementById('cashier-password-input');
const screenLockForm = document.getElementById('screen-lock-form');

async function checkCashierPassword(password) {
    const storedPassword = (await db.get(STORES.APP_STATE, 'cashierPassword'))?.value || '1234';
    return password === storedPassword;
}

async function lockScreen() {
    const adminPromptVisible = !document.getElementById('password-prompt-overlay').classList.contains('hidden');
    if (screenLockOverlay && !adminPromptVisible) {
        screenLockOverlay.classList.remove('hidden');
        if (cashierPasswordInput) cashierPasswordInput.focus();
        await db.put(STORES.APP_STATE, { key: 'isScreenLocked', value: true });
    }
}

async function resetTimer() {
    try {
        clearTimeout(idleTimer);
        const timeoutMinutes = Number((await db.get(STORES.APP_STATE, 'screenLockTimeout'))?.value);
        if (isFinite(timeoutMinutes) && timeoutMinutes > 0) {
            idleTimer = setTimeout(lockScreen, timeoutMinutes * 60 * 1000);
        }
    } catch (err) {
        console.error('Failed to reset idle timer', err);
    }
}

async function handleUnlock(event) {
    if (event) event.preventDefault();
    const password = cashierPasswordInput.value;
    if (!password) return showToast('الرجاء إدخال كلمة المرور.', 'error');

    if (await checkCashierPassword(password)) {
        screenLockOverlay.classList.add('hidden');
        cashierPasswordInput.value = '';
        await db.put(STORES.APP_STATE, { key: 'isScreenLocked', value: false });
        // --- الحل للمشكلة الثانية موجود هنا ---
        // هذا السطر يضمن إعادة تشغيل مؤقت عدم النشاط من جديد بعد الفتح الناجح
        // مما يمنع ظهور شاشة القفل مرة أخرى بشكل مباشر
        await resetTimer();
    } else {
        showToast('كلمة المرور غير صحيحة!', 'error');
        const promptBox = screenLockForm.closest('.password-prompt-box');
        if (promptBox) {
            promptBox.classList.add('shake');
            setTimeout(() => promptBox.classList.remove('shake'), 500);
        }
        cashierPasswordInput.value = '';
        cashierPasswordInput.focus();
    }
}

export async function initSecurity() {
    const lockState = (await db.get(STORES.APP_STATE, 'isScreenLocked'))?.value;
    if (lockState === true) {
        lockScreen();
    } else {
        resetTimer();
    }
    
    const activityEvents = ['mousemove','mousedown','keydown','keyup','touchstart','touchmove','scroll','focus'];
    activityEvents.forEach(ev => window.addEventListener(ev, resetTimer, { passive: true }));
    document.addEventListener('visibilitychange', () => !document.hidden && resetTimer());
    document.addEventListener('screenLockTimeoutChanged', resetTimer);
    screenLockForm?.addEventListener('submit', handleUnlock);
}