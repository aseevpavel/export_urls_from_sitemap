# Export URLs from XML sitemap (Tampermonkey userscript)

This is a Tampermonkey userscript that extracts all `<loc>` URLs from XML sitemaps and opens them in a clean, full-screen UI.  
You can review the URLs, edit them, copy them to the clipboard, or export to a `.txt` file.

## Features

- Works on:
  - plain `urlset` sitemaps
  - `sitemapindex` (recursively follows child sitemaps)
- Parses raw XML directly via `fetch` + `DOMParser` (not the browser pretty view)
- Full-screen, responsive UI in a separate tab
- Editable textarea with all links (one URL per line)
- Two actions:
  - **Copy links** to clipboard
  - **Download** as `<domain>.txt` file

## Requirements

- Browser with [Tampermonkey](https://www.tampermonkey.net/) (or compatible userscript manager)

## Installation

1. Install Tampermonkey in your browser.
2. Open the raw `sitemap_export.user.js` file from this repository.
3. Click the **Raw** button (if you are on GitHub).
4. Your browser should prompt Tampermonkey → confirm installation.

Alternatively, you can copy the script content and create a **New script** in Tampermonkey, then paste and save.

## Usage

1. Open any XML sitemap in the browser.  
   The script matches:
   - URLs containing `.xml`
   - URLs containing `sitemap` (e.g. `/sitemap`, `/sitemap_index`, etc.)
2. When the script detects `<loc>` entries, a floating button **“Экспорт ссылок”** appears in the bottom-right corner.
3. Click the button:
   - A new tab will open with a full-screen panel.
   - All collected URLs are listed in a textarea (one per line).
4. In the panel you can:
   - Edit the list if needed.
   - Click **“Копировать ссылки”** to copy to clipboard.
   - Click **“Экспорт в текстовый файл”** to download a `<domain>.txt` file.

## Notes

- For `sitemapindex` files, the script follows child sitemap URLs recursively and collects final URLs from all of them.
- If some sitemaps are unreachable or broken, they are skipped — the rest is still processed.
- The script is designed to work even when the sitemap is served as `application/xml` (not as an HTML page).

