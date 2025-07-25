# Upcoming Book Feature

This feature provides API and frontend support for displaying the **next unreleased book** in a series for a library item. It integrates backend scraping, caching, and frontend display.

---

## **How It Works**

- The backend checks if the selected book is the last in its series.
- If so, it scrapes RisingShadow.net for the next unreleased book.
- The result is cached and returned via API.
- The frontend displays the upcoming book info, including cover, title, release date, and link.

---

## **API Endpoint**

```
GET /api/items/:id/upcoming
```

Returns:

```json
{ "book": { ...upcomingBookInfo } }
```

---

## **Files Involved**

### **Backend**

- `server/controllers/UpcomingBookController.js`
- `server/services/UpcomingBookService.js`
- `server/utils/upcoming/risingShadowScraper.js`
- `server/utils/upcoming/seriesUtils.js`
- `server/utils/upcoming/metadataCacheStorageManager.js`
- `server/Logger.js`

### **Frontend**

- `client/components/content/LibraryItemDetails.vue`
- `client/components/modals/UpcomingCoverPreviewModal.vue`
- `client/strings/*.json` (locale strings for all languages)

---

## **Logging**

All major steps are logged with numbered statements for easy tracing, e.g.:

```
[UpcomingBook 1.0] ENTERED FUNCTION
[UpcomingBook 9.0] Built search URL: ...
[UpcomingBook 16.0] Initialized with base path: ...
```

---

## **Localization**

Locale strings for the feature are added to all language files in `client/strings/`.

---

## **Setup**

1. Ensure all backend files are present and imported correctly.
2. Add locale strings to all JSON files in `client/strings/`.
3. Use the API endpoint in your frontend component to display upcoming book info.

---

## **Usage Example (Frontend)**

```vue
<template>
  <div v-if="upcomingBook">
    <h3>{{ $strings.LabelUpcomingBook }}: {{ upcomingBook.title }}</h3>
    <img :src="upcomingBook.cover" alt="Cover" />
    <p>{{ $strings.LabelReleaseDate }}: {{ upcomingBook.release }}</p>
    <a :href="upcomingBook.link" target="_blank">More Info</a>
  </div>
  <div v-else>
    <p>{{ $strings.UpcomingBookNoBook }}</p>
  </div>
</template>
```

---

## **Maintenance**

- Cached results and covers are managed by `metadataCacheStorageManager.js`.
- Maintenance and refresh logic is handled in `UpcomingBookService.js`.

---

## **Contributing**

- Add new locale translations to `client/strings/`.
- Extend scraping logic in `risingShadowScraper.js` as needed.
- Improve frontend display in `LibraryItemDetails.vue` and `UpcomingCoverPreviewModal.vue`.

---
