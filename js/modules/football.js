// js/modules/football.js

import * as db from './db.js';
import { STORES } from './db.js';
import { showToast } from '../utils.js';
import { printReceipt } from './printing.js';

async function handleFootballPrint() {
    const priceInput = document.getElementById('football-price');
    const price = parseFloat(priceInput.value);
    const reservationDate = document.getElementById('reservation-date').value;

    if (!price || price <= 0) {
        return showToast('الرجاء إدخال مبلغ صحيح وموجب.', 'error');
    }

    let timeDisplay;
    if (document.getElementById('manual-time-toggle').checked) {
        const start = document.getElementById('start-time').value;
        const end = document.getElementById('end-time').value;
        if (!start || !end) return showToast('الرجاء التأكد من إدخال وقت البداية والنهاية.', 'error');
        if (start >= end) return showToast('وقت النهاية يجب أن يكون بعد وقت البداية.', 'error');
        timeDisplay = `${start} - ${end}`;
    } else {
        timeDisplay = document.getElementById('time-slot').value;
    }
    
    const invoiceCounterState = await db.get(STORES.APP_STATE, 'invoiceCounter');
    const newId = (invoiceCounterState?.value || 0) + 1;

    const newInvoice = {
        id: newId,
        type: 'football',
        sectionName: 'الميادين',
        date: new Date(`${reservationDate}T${new Date().toTimeString().split(' ')[0]}`).toISOString(),
        details: {
            fieldName: document.getElementById('field-name').value,
            timeDisplay
        },
        total: price
    };

    await db.add(STORES.INVOICES, newInvoice);
    await db.put(STORES.APP_STATE, { key: 'invoiceCounter', value: newId });
    
    showToast('تم إصدار فاتورة الملعب بنجاح.');
    printReceipt(newInvoice);
    priceInput.value = '';
}

export async function renderQuickPricesOnFootballPage() {
    const quickPrice = (await db.get(STORES.APP_STATE, 'quickPrice'))?.value || 20000;
    const quickPriceBtn = document.getElementById('quick-price-btn');
    if(quickPriceBtn) {
        quickPriceBtn.textContent = quickPrice;
    }
}

export function initFootball() {
    document.getElementById('print-football-invoice')?.addEventListener('click', handleFootballPrint);

    document.getElementById('quick-price-btn')?.addEventListener('click', async () => {
        const quickPrice = (await db.get(STORES.APP_STATE, 'quickPrice'))?.value;
        document.getElementById('football-price').value = quickPrice || '';
    });

    const manualTimeToggle = document.getElementById('manual-time-toggle');
    manualTimeToggle?.addEventListener('change', () => {
        const isManual = manualTimeToggle.checked;
        document.getElementById('time-slot-container').style.display = isManual ? 'none' : 'block';
        document.getElementById('manual-time-container').classList.toggle('manual-time-hidden', !isManual);
    });

    renderQuickPricesOnFootballPage();
}