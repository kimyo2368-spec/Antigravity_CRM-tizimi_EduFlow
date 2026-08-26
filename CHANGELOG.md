# CHANGELOG — EduFlow CRM

Barcha muhim o'zgarishlar va versiyalar ushbu faylda qayd etib boriladi.

---

## [v1.8.0] - 2026-08-02 (39 ta Audit Kamchiligi To'liq Tuzatildi)

### 🔴 KRITIK — Xavfsizlik (5 ta)
- 🔐 **Haqiqiy hash funksiyasi** — `btoa()` (base64) olib tashlanib, DJB2+FNV+salt 500-raundli hashing qo'yildi
- 🔐 **Ochiq `password` maydoni olib tashlandi** — INITIAL_DATABASE dan va localStorage migratsiyasida `password` butunlay tozalandi
- 🔐 **Sessiyada parol saqlanmaydi** — `localStorage` ga faqat `id, fullName, email, role, branchId` saqlanadi
- 🔐 **"Eslab qolish" checkbox ishlaydi** — Belgilanmasa `sessionStorage`, belgilansa `localStorage`
- 🔐 **HTML dan parol olib tashlandi** — Placeholder va `<small>Parol: admin123</small>` tozalandi

### 🟠 JIDDIY — Funksionallik (14 ta)
- 🏢 **Filial selektori ishlaydi** — `global-branch-selector` ga change event ulandi, barcha modullar filtrlanadi
- 📋 **Davomat guruh/sana o'zgartirish** — `att-group-select` va `att-date-select` ga change listener qo'shildi
- ➕ **Yangi guruh qo'shish** — Modal form va `insert('groups', ...)` logikasi
- ➕ **Yangi o'qituvchi qo'shish** — Modal form va `insert('users', ...)` logikasi
- ➕ **Yangi lid kiritish** — Modal form va `insert('leads', ...)` logikasi
- ➡️ **Lid bosqichini o'zgartirish** — "Keyingi" tugmasi bilan lidni bosqichlar orasida ko'chirish
- ➕ **Uy vazifasi qo'shish** — Yangi topshiriq yaratish modal formasi
- 🖨️ **Sertifikat print** — `alert()` o'rniga HTML sertifikat va `window.print()`
- 📋 **Telegram xabar jurnali** — Yuborilgan xabarlar `telegramLog` ga saqlanadi va ko'rsatiladi
- 🌐 **Til selektori** — Tanlanganda "Tez kunda qo'shiladi!" xabari
- 📡 **Online/Offline badge** — `navigator.onLine` va hodisalarga ulangan
- 🧾 **Kvitansiya modal** — HTML formatli chek ko'rinishi va `window.print()`
- 🗑️ **O'quvchi o'chirish** — Tasdiqlash bilan `db.remove('students', id)`
- ❌ **To'lov bekor qilish** — Bekor qilish va balansni qaytarish

### 🟡 O'RTA — Mantiq (8 ta)
- 🆔 **generateCode duplikat tuzatildi** — maxID+1 yondashuvi (o'chirilgan yozuvlar bilan ziddiyatsiz)
- 📅 **"Bugungi darslar" haqiqiy** — Haftaning bugungi kuniga qarab `scheduleDays` dan filtrlanadi
- 💰 **P&L oylik filtr** — `payment.month === currentMonth` filtrlanadi (barcha vaqt emas)
- 📆 **Kalendar matrisi to'g'ri** — `filter()` + hafta kuni mos guruhlar, 2+ guruhni ko'rsatish
- 🎓 **O'quvchi qo'shishda guruh** — Formaga guruh tanlash `<select>` qo'shildi
- 🗑️ **`DatabaseService.delete()` metodi** — `db.remove(collection, id)` qo'shildi
- 🛡️ **CSP — `unsafe-inline` faqat style** — `script-src 'self'` bilan kuchaytirildi
- 🧹 **Inline onclick→addEventListener** — 20+ joyda event delegation pattern

### 🔵 KICHIK — UX (12 ta)
- 🏷️ **Versiya birlashtirildi** — Barcha 3 faylda v1.8.0
- 🌙 **Mavzu localStorage** — Sahifa yangilanganida mavzu tiklanadi
- 📱 **Mobil sidebar** — Hamburger menyu, `translateX(-100%)` yashirish, tap-to-close
- ⌨️ **ESC va backdrop click** — Barcha modallar uchun
- 🔄 **Focus trap** — Login modalida
- 🍞 **Toast izchilligi** — Barcha joyda `escapeHTML`
- 📝 **Duplikat font olib tashlandi** — CSS dagi `@import` o'chirildi
- 📦 **`supabase` → `db` nomi** — Chalg'itmaydigan nom
- ⚠️ **Telegram token ogohlantirish** — Sozlamalardan olib tashlandi
- 📄 **Pagination** — O'quvchilar va to'lovlar 15 ta/sahifa
- ⏳ **Loading spinner** — Modul render paytida ko'rsatiladi
- 📊 **Monitoring real data** — localStorage hajmi (KB), yozuvlar soni, RBAC holati
