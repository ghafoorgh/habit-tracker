# عادت‌ها (Habit Tracker)

یک برنامهٔ سادهٔ ثبت عادت برای آیفون و اندروید، کاملاً فارسی و راست‌به‌چپ، ساخته‌شده با [Expo](https://expo.dev) (SDK 58) و Expo Router.

## امکانات

- **صفحهٔ امروز**: تاریخ شمسی امروز، تعداد عادت‌های انجام‌شده و نوار پیشرفت. هر عادت را با یک لمس تیک بزن.
- **هفتهٔ اخیر**: هفت روز گذشته زیر هر عادت نمایش داده می‌شود. با لمس هر روز می‌توانی آن را ثبت یا لغو کنی.
- **زنجیره‌ها**: تعداد روزهای پشت سر هم برای هر عادت. زنجیره تا پایان روز قطع نمی‌شود.
- **آمار**: زنجیرهٔ فعلی، بهترین زنجیره، درصد انجام در ۳۰ روز اخیر و تقویم ۱۵ هفتهٔ گذشته (هفته از شنبه شروع می‌شود).
- **شخصی‌سازی**: نام، نماد (از جمله 🕌 📿 📖 🫖) و رنگ (فیروزه‌ای، آبی ایرانی، زعفرانی، اناری، پسته‌ای و …).
- تقویم هجری شمسی، اعداد فارسی، فونت وزیرمتن، حالت روشن و تاریک، لرزش هنگام تیک زدن.
- همهٔ اطلاعات روی خود گوشی ذخیره می‌شود و به حساب کاربری نیازی نیست.

## اجرا روی گوشی

۱. برنامهٔ **Expo Go** را از App Store یا Google Play نصب کن.

۲. روی کامپیوتر (Node نسخهٔ ۲۰ یا بالاتر):

```bash
npm install
npx expo start
```

۳. کد QR را در آیفون با دوربین و در اندروید از داخل Expo Go اسکن کن.

> اگر بار اول صفحه چپ‌به‌راست نمایش داده شد، برنامه را یک بار کامل ببند و دوباره باز کن. چیدمان راست‌به‌چپ از اجرای بعدی اعمال می‌شود.

## ساخت نسخهٔ نصبی

با [EAS Build](https://docs.expo.dev/build/introduction/) و بدون نیاز به Xcode یا Android Studio:

```bash
npx eas-cli@latest build --profile preview --platform ios   # نسخهٔ آزمایشی (نه انتشار در App Store)
```

شناسهٔ برنامه در `app.json` برابر `com.ghafoorgh.habittracker` است.

## Testing on an iPhone (English)

**Option A: Expo Go (free, no Apple account).** Everything the app uses ships inside Expo Go, so no custom build is needed.

1. Install **Expo Go** from the App Store. It must support SDK 58, which the current App Store version (58.x) does.
2. On a Mac or Windows PC with Node 20+ and Git:
   ```bash
   git clone https://github.com/ghafoorgh/habit-tracker.git
   cd habit-tracker
   git checkout claude/habit-tracker-expo-app-eds1ya
   npm install
   npx expo start
   ```
3. Put the iPhone on the same Wi‑Fi. Scan the QR code with the iPhone Camera, or pick the server under **Development servers** in Expo Go.
   If it doesn't appear (guest Wi‑Fi, VPN, firewall), use `npx expo start --tunnel` instead.
4. If the first launch is left-to-right, force-quit Expo Go and reopen it. RTL applies from the next launch.

**Option B: installable build via EAS (needs an Apple Developer account, $99/year).**
`eas.json` has only internal-testing profiles. There is deliberately no `production` profile, so nothing can be built for or submitted to the App Store by accident.

```bash
npx eas-cli@latest login
npx eas-cli@latest init                      # links the project to your Expo account
npx eas-cli@latest device:create             # register your iPhone (ad hoc)
npx eas-cli@latest build --profile preview --platform ios
```

`preview-simulator` builds for the iOS Simulator on a Mac instead.

**Not included:** subscriptions, in-app purchases and payments. There is no payment code or payment SDK in the project.

## Checks

```bash
npm run check                                # typecheck + lint + unit tests
npx expo-doctor                              # dependency / config health
```

## توسعه

```bash
npm run typecheck   # بررسی TypeScript
npm test            # تست‌های تقویم شمسی و محاسبهٔ زنجیره
```

### ساختار پروژه

```
src/
  app/                 صفحه‌ها (Expo Router)
    _layout.tsx        فونت، راست‌به‌چپ و ذخیرهٔ داده
    (tabs)/index.tsx   امروز
    (tabs)/stats.tsx   آمار
    habit/new.tsx      عادت جدید
    habit/[id].tsx     ویرایش / حذف عادت
  components/          HabitRow، HabitForm، Heatmap، Text (فونت وزیرمتن)
  lib/
    jalali.ts          تبدیل تاریخ میلادی به شمسی، نام ماه‌ها و روزها، اعداد فارسی
    dates.ts           توابع کمکی تاریخ
    habits.ts          محاسبهٔ زنجیره و درصد انجام
    store.tsx          وضعیت عادت‌ها و ذخیره در AsyncStorage
    theme.ts           رنگ‌ها و نمادها
```
