// js/modules/backup.js

import * as db from './db.js';
import { STORES } from './db.js';
import { formatDateWithEnglishNumerals, showToast } from '../utils.js';
import { getBackupDataAsObject, importData, deleteAllData } from './data.js';
import { requestPassword } from './ui.js';

let fileHandle = null;

async function verifyPermission(handle, readWrite = true) {
    try {
        if (!handle || typeof handle.queryPermission !== 'function') return false;
        const options = readWrite ? { mode: 'readwrite' } : {};
        if ((await handle.queryPermission(options)) === 'granted') return true;
        return (await handle.requestPermission(options)) === 'granted';
    } catch (err) {
        console.warn('verifyPermission failed', err);
        return false;
    }
}

async function exportDataWithPicker() {
    try {
        if (!fileHandle) {
            const savedHandle = (await db.get(STORES.APP_STATE, 'backupFileHandle'))?.value;
            if (savedHandle && typeof savedHandle.createWritable === 'function') {
                fileHandle = savedHandle;
            }
        }

        const dataToExport = await getBackupDataAsObject();
        const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: 'application/json' });

        if (fileHandle && await verifyPermission(fileHandle, true)) {
            try {
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                await db.put(STORES.APP_STATE, { key: 'lastBackupInfo', value: { date: new Date().toISOString(), filename: fileHandle.name } });
                await renderBackupPage();
                showToast(`تم تحديث النسخة الاحتياطية بنجاح في ملف: ${fileHandle.name}`);
                return;
            } catch (err) {
                console.warn('Could not write to the saved file handle.', err);
                fileHandle = null;
                await db.deleteItem(STORES.APP_STATE, 'backupFileHandle');
            }
        }

        const newHandle = await window.showSaveFilePicker({
            types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await newHandle.createWritable();
        await writable.write(blob);
        await writable.close();
        fileHandle = newHandle;
        await db.put(STORES.APP_STATE, { key: 'backupFileHandle', value: fileHandle });
        await db.put(STORES.APP_STATE, { key: 'lastBackupInfo', value: { date: new Date().toISOString(), filename: newHandle.name } });
        await renderBackupPage();
        showToast('تم تصدير البيانات بنجاح.');

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error('Export failed:', error);
            showToast('فشل تصدير البيانات.', 'error');
        }
    }
}

export async function renderBackupPage() {
    const backupInfo = (await db.get(STORES.APP_STATE, 'lastBackupInfo'))?.value;
    const infoElement = document.getElementById('last-backup-info');
    if (infoElement) {
        if (backupInfo) {
            const { date, filename } = backupInfo;
            const formattedDate = formatDateWithEnglishNumerals(date);
            infoElement.innerHTML = `<strong>تاريخ آخر نسخة:</strong> ${formattedDate}<br><strong>اسم الملف:</strong> ${filename}`;
        } else {
            infoElement.textContent = 'لم يتم أخذ نسخة احتياطية بعد.';
        }
    }
}

export function initBackup() {
    const importFileInput = document.getElementById('import-file-input');
    document.getElementById('export-data')?.addEventListener('click', exportDataWithPicker);
    document.querySelector('label[for="import-file-input"]')?.addEventListener('click', (e) => {
        e.preventDefault();
        requestPassword(() => importFileInput.click());
    });
    importFileInput?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            importData(file);
        }
        e.target.value = null;
    });
    document.getElementById('delete-all-data')?.addEventListener('click', () => {
        requestPassword(deleteAllData);
    });
}