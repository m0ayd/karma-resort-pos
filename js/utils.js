// js/utils.js

import * as db from './modules/db.js';
import { STORES } from './modules/db.js';

// وظائف مساعدة عامة لا تعتمد على حالة التطبيق

export function formatDateWithEnglishNumerals(dateInput) {
    if (!dateInput) return '';
    const date = new Date(dateInput);
    const options = { 
        year: 'numeric', 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true, 
        numberingSystem: 'latn' 
    };
    let formattedDate = new Intl.DateTimeFormat('en-GB', options).format(date);
    formattedDate = formattedDate.replace(',', '')
                                 .replace(/am/i, 'صباحاً')
                                 .replace(/pm/i, 'مساءً');
    return formattedDate;
}

export function debounce(func, delay = 300) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

export function showToast(message, type = 'success') {
    const toast = document.getElementById('toast-notification');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'show';
    toast.classList.add(type === 'error' ? 'error' : 'success');
    setTimeout(() => { toast.className = toast.className.replace('show', ''); }, 3000);
}

window.resetAdminPassword = async function() {
  try {
    await db.put(STORES.APP_STATE, { key: 'adminPassword', value: '1234' });
    console.log('%cPassword has been reset to "1234"', 'color: green; font-size: 16px; font-weight: bold;');
    alert('تمت إعادة تعيين كلمة مرور المدير بنجاح إلى القيمة الافتراضية: 1234');
  } catch (error) {
    console.error('Failed to reset password:', error);
    alert('فشلت عملية إعادة تعيين كلمة المرور.');
  }
};

window.resetCashierPassword = async function() {
  try {
    await db.put(STORES.APP_STATE, { key: 'cashierPassword', value: '1234' });
    console.log('%cCashier password has been reset to "1234"', 'color: blue; font-size: 16px; font-weight: bold;');
    alert('تمت إعادة تعيين كلمة مرور الكاشير بنجاح إلى القيمة الافتراضية: 1234');
  } catch (error) {
    console.error('Failed to reset cashier password:', error);
    alert('فشلت عملية إعادة تعيين كلمة مرور الكاشير.');
  }
};