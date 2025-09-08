// js/main.js (الملف الموجود داخل مجلد js)

import * as db from './modules/db.js';
import * as data from './modules/data.js';
import * as ui from './modules/ui.js';
import { initFootball } from './modules/football.js';
import { initHistory } from './modules/history.js';
import { initSettings } from './modules/settings.js';
import { initBackup } from './modules/backup.js';
import { initSecurity } from './modules/security.js';

// الانتظار حتى يتم تحميل محتوى الصفحة بالكامل
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // 1. تهيئة قاعدة البيانات أولاً
        await db.initDB();
        console.log("Database initialized.");

        // 2. إضافة البيانات الأولية إذا لم تكن موجودة
        await data.seedInitialData();
        console.log("Initial data seeded (if necessary).");

        // 3. بناء الأقسام الديناميكية في الواجهة
        await ui.initDynamicSections();
        console.log("Dynamic sections initialized.");

        // 4. تهيئة الوحدات الأساسية لواجهة المستخدم
        ui.initializeUI();
        initFootball();
        initHistory();
        initSettings();
        initBackup();

        // 5. ربط أحداث التنقل في القائمة الجانبية
        ui.bindNavEvents();
        console.log("Navigation events bound.");

        // 6. تهيئة نظام الأمان وقفل الشاشة
        initSecurity();
        console.log("Security features initialized.");

        // 7. الانتقال إلى الصفحة الافتراضية عند بدء التشغيل
        ui.navigateTo('restaurant');
        console.log("Application loaded successfully.");

    } catch (error) {
        console.error("Failed to initialize the application:", error);
        document.body.innerHTML = '<h1>حدث خطأ فادح أثناء تشغيل التطبيق. يرجى مراجعة الـ Console.</h1>';
    }
});