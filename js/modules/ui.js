// js/modules/ui.js

import { renderInvoicesHistory } from './history.js';
import { renderAllSettings } from './settings.js';
import { renderQuickPricesOnFootballPage } from './football.js';
import { renderBackupPage } from './backup.js';
import * as db from './db.js';
import { STORES } from './db.js';
import { showToast } from '../utils.js';
import { initPos } from './pos.js';
import { printReceipt } from './printing.js';

const templates = {
    pos: (section) => `<div class="pos-grid"><div class="items-section"><header class="page-header"><h3>أصناف ${section.name}</h3><p>اختر الأصناف لإضافتها إلى الفاتورة</p></header><div id="${section.id}-items-grid" class="items-grid"><p class="empty-invoice">لم يتم إضافة أصناف.</p></div></div><div class="invoice-section"><h3>الفاتورة الحالية</h3><div id="${section.id}-invoice-items" class="invoice-items"><p class="empty-invoice">لم يتم إضافة أي صنف بعد</p></div><div class="invoice-summary"><div class="summary-row total"><span>المجموع الكلي</span><span id="${section.id}-total">0.00 SDG</span></div></div><div class="invoice-actions"><div class="main-buttons"><button data-action="clear" data-section-id="${section.id}" class="clear-button">إفراغ</button><button data-action="print" data-section-id="${section.id}" class="print-button">إصدار وطباعة</button></div></div></div></div>`,
    booking: (section) => `<header class="page-header"><h2>إصدار فاتورة ${section.name}</h2></header><div class="form-container" data-section-id="${section.id}"><label for="reservation-date-${section.id}">تاريخ الحجز:</label><input type="date" id="reservation-date-${section.id}" class="booking-reservation-date" autocomplete="off" readonly><div class="time-selection-wrapper"><div id="time-slot-container-${section.id}"><label for="time-slot-${section.id}">اختر موعد جاهز:</label><select id="time-slot-${section.id}" class="booking-time-slot" autocomplete="off"></select></div><div id="manual-time-container-${section.id}" class="manual-time-hidden"><label>أو أدخل الوقت يدويًا:</label><div class="manual-time-inputs"><div class="time-input-group"><label for="start-time-${section.id}">وقت البداية</label><input type="time" id="start-time-${section.id}" class="booking-start-time"></div><span>-</span><div class="time-input-group"><label for="end-time-${section.id}">وقت النهاية</label><input type="time" id="end-time-${section.id}" class="booking-end-time"></div></div></div><div class="toggle-time-entry"><input type="checkbox" id="manual-time-toggle-${section.id}" class="booking-manual-time-toggle"><label for="manual-time-toggle-${section.id}">إدخال وقت مخصص</label></div></div><label for="booking-price-${section.id}">المبلغ المستلم: <span class="required">*</span></label><div class="quick-price-buttons"><button class="quick-price-btn booking-quick-price-btn" id="quick-price-btn-${section.id}">0</button></div><input type="number" id="booking-price-${section.id}" class="booking-price" placeholder="أدخل المبلغ الإجمالي" required><button data-action="print-booking" data-section-id="${section.id}" class="print-button">إصدار فاتورة</button></div>`,
    simple: (section) => `<header class="page-header"><h2>إصدار فاتورة ${section.name}</h2></header><div class="form-container" data-section-id="${section.id}"><label for="simple-service-${section.id}">وصف الخدمة: <span class="required">*</span></label><input type="text" id="simple-service-${section.id}" class="simple-service-name" value="${section.name}" required><label for="simple-price-${section.id}">المبلغ المستلم: <span class="required">*</span></label><input type="number" id="simple-price-${section.id}" class="simple-price" placeholder="أدخل المبلغ" required><button data-action="print-simple" data-section-id="${section.id}" class="print-button">إصدار فاتورة</button></div>`
};

export function createSectionUI(section) {
    const menu = document.getElementById('main-menu');
    const settingsLink = menu.querySelector('[data-target="settings"]');
    const menuItem = document.createElement('a');
    menuItem.href = '#';
    menuItem.className = 'menu-item';
    menuItem.dataset.target = section.id;
    menuItem.innerHTML = `${section.icon || '🔹'} ${section.name}`;
    menu.insertBefore(menuItem, settingsLink);

    const mainContent = document.getElementById('main-content-area');
    const pageDiv = document.createElement('div');
    pageDiv.id = section.id;
    pageDiv.className = 'page';
    pageDiv.innerHTML = templates[section.template](section);
    mainContent.appendChild(pageDiv);
}

export async function initDynamicSections() {
    const customSections = (await db.get(STORES.APP_STATE, 'customSections'))?.value || [];
    customSections.forEach(createSectionUI);
}

let onPasswordSuccessCallback = null;
const passwordPrompt = document.getElementById('password-prompt-overlay');
const passwordInput = document.getElementById('password-input');

function hidePasswordPrompt() {
    passwordPrompt.classList.add('hidden');
    passwordInput.value = '';
    onPasswordSuccessCallback = null;
}

export function requestPassword(onSuccess) {
    onPasswordSuccessCallback = onSuccess;
    passwordPrompt.classList.remove('hidden');
    passwordInput.focus();
}

async function setupBookingPage(sectionId) {
    const sections = (await db.get(STORES.APP_STATE, 'customSections'))?.value || [];
    const section = sections.find(s => s.id === sectionId);
    if (section?.template === 'booking') {
        const quickPriceBtn = document.getElementById(`quick-price-btn-${section.id}`);
        if(quickPriceBtn) quickPriceBtn.textContent = section.quickPrice || 0;
        populateTimeSlots(document.getElementById(`time-slot-${section.id}`));
        const dateInput = document.getElementById(`reservation-date-${section.id}`);
        if (dateInput) dateInput.valueAsDate = new Date();
    }
}

export function navigateTo(targetId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(targetId)?.classList.add('active');
    document.querySelectorAll('.menu-item').forEach(item => item.classList.toggle('active', item.dataset.target === targetId));

    if (targetId === 'history') renderInvoicesHistory();
    else if (targetId === 'settings') renderAllSettings();
    else if (targetId === 'backup') renderBackupPage();
    else if (targetId === 'football') {
        document.getElementById('reservation-date').valueAsDate = new Date();
        renderQuickPricesOnFootballPage();
    } else {
        const targetPage = document.getElementById(targetId);
        if (targetPage?.querySelector('.pos-grid')) initPos(targetId);
        else if (targetPage?.querySelector('.form-container[data-section-id]')) setupBookingPage(targetId);
    }
    document.querySelector('.sidebar')?.classList.remove('visible');
    document.querySelector('.sidebar-overlay')?.classList.remove('visible');
}

function populateTimeSlots(selectElement) {
    if (!selectElement) return;
    selectElement.innerHTML = '';
    const formatHour = (h) => new Date(2025,0,1,h).toLocaleTimeString('ar-EG', {hour:'numeric', minute:'2-digit'});
    for (let i = 7; i < 24; i++) {
        const option = document.createElement('option');
        option.value = `${formatHour(i)} - ${formatHour(i + 1)}`;
        option.textContent = option.value;
        selectElement.appendChild(option);
    }
}

async function handleDynamicSectionActions(e) {
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    const { action, sectionId } = button.dataset;
    const formContainer = button.closest('.form-container');
    const sections = (await db.get(STORES.APP_STATE, 'customSections'))?.value || [];
    const sectionInfo = sections.find(s => s.id === sectionId);
    if (!sectionInfo) return;

    const newId = ((await db.get(STORES.APP_STATE, 'invoiceCounter'))?.value || 0) + 1;
    let newInvoice;

    if (action === 'print-simple') {
        const serviceNameInput = formContainer.querySelector('.simple-service-name');
        const priceInput = formContainer.querySelector('.simple-price');
        const price = parseFloat(priceInput.value);
        if (!price || price <= 0) return showToast('الرجاء إدخال مبلغ صحيح.', 'error');
        newInvoice = { id: newId, sectionName: sectionInfo.name, date: new Date().toISOString(), type: 'simple', total: price, details: { serviceName: serviceNameInput.value.trim() || sectionInfo.name }};
        priceInput.value = '';
    } else if (action === 'print-booking') {
        const priceInput = formContainer.querySelector('.booking-price');
        const price = parseFloat(priceInput.value);
        if (!price || price <= 0) return showToast('الرجاء إدخال مبلغ صحيح.', 'error');
        const isManual = formContainer.querySelector('.booking-manual-time-toggle').checked;
        const timeDisplay = isManual ? `${formContainer.querySelector('.booking-start-time').value} - ${formContainer.querySelector('.booking-end-time').value}` : formContainer.querySelector('.booking-time-slot').value;
        newInvoice = { id: newId, type: 'booking', sectionName: sectionInfo.name, date: new Date().toISOString(), details: { timeDisplay }, total: price };
        priceInput.value = '';
    }
    
    if (newInvoice) {
        await db.add(STORES.INVOICES, newInvoice);
        await db.put(STORES.APP_STATE, { key: 'invoiceCounter', value: newId });
        showToast('تم إصدار الفاتورة بنجاح.');
        printReceipt(newInvoice);
    }
}

export function initializeUI() {
    populateTimeSlots(document.getElementById('time-slot'));
    const sidebar = document.querySelector('.sidebar');
    const sidebarToggle = document.querySelector('.sidebar-toggle');
    const sidebarOverlay = document.querySelector('.sidebar-overlay');
    sidebarToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('visible');
        sidebarOverlay.classList.toggle('visible');
    });
    sidebarOverlay?.addEventListener('click', () => {
        sidebar.classList.remove('visible');
        sidebarOverlay.classList.remove('visible');
    });

    document.querySelector('.password-prompt-box')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const storedPassword = (await db.get(STORES.APP_STATE, 'adminPassword'))?.value || '1234';
        if (passwordInput.value === storedPassword) {
            onPasswordSuccessCallback?.();
            hidePasswordPrompt();
        } else {
            showToast('كلمة المرور غير صحيحة!', 'error');
            passwordInput.value = '';
        }
    });
    document.getElementById('password-cancel-btn')?.addEventListener('click', hidePasswordPrompt);
    document.getElementById('main-content-area')?.addEventListener('click', e => {
        handleDynamicSectionActions(e);
        if(e.target.matches('.booking-quick-price-btn')) {
            e.target.closest('.form-container').querySelector('.booking-price').value = e.target.textContent;
        }
    });
    document.getElementById('main-content-area')?.addEventListener('change', e => {
        if (e.target.matches('.booking-manual-time-toggle')) {
            const sectionId = e.target.closest('.form-container').dataset.sectionId;
            const isManual = e.target.checked;
            document.getElementById(`time-slot-container-${sectionId}`).style.display = isManual ? 'none' : 'block';
            document.getElementById(`manual-time-container-${sectionId}`).classList.toggle('manual-time-hidden', !isManual);
        }
    });
}

export function bindNavEvents() {
    document.getElementById('main-menu')?.addEventListener('click', e => {
        const menuItem = e.target.closest('.menu-item');
        if (menuItem) {
            e.preventDefault();
            const { target } = menuItem.dataset;
            // --- بداية الحل للمشكلة الثالثة ---
            // تم إزالة 'backup' من الشرط
            // الآن كلمة المرور مطلوبة فقط عند الدخول إلى الإعدادات
            if (target === 'settings') {
                requestPassword(() => navigateTo(target));
            } else {
                navigateTo(target);
            }
            // --- نهاية الحل للمشكلة الثالثة ---
        }
    });
}