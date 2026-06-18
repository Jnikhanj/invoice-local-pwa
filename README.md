# InvoiceMate Local

InvoiceMate Local is a local-first, Safari-compatible invoice builder for Australian invoices.

## Version 0.2.0

This zip restores the cleaner compact visual style and fixes iPhone Home Screen sizing without making the UI bulky.

## What changed in this design update

- Restored compact horizontal navigation.
- Removed the bulky 3-column mobile nav.
- Reduced card, button, and form spacing on iPhone.
- Changed mobile dashboard metrics to compact two-column cards.
- Added stronger horizontal overflow protection.
- Added iPhone safe-area top padding so the header does not sit under the time/status bar.
- Updated cache-busting versions to `0.2.0`.
- Added `reset-app-cache.html` to refresh the old app shell safely.

## Core features

- Australian Invoice / Tax Invoice layout
- ABN field with local checksum validation
- GST registered toggle
- GST exclusive and inclusive calculation modes
- 10% GST calculation
- AUD currency formatting
- BSB/account payment details
- Local IndexedDB storage
- Backup export/import as JSON
- Print/save-to-PDF layout

## Manual GitHub upload

Upload all files and folders in this zip into the root of the `invoice-local-pwa` repository and overwrite existing files when prompted.

After upload, open:

`https://jnikhanj.github.io/invoice-local-pwa/reset-app-cache.html`

Then delete the old Home Screen icon and add the app again from:

`https://jnikhanj.github.io/invoice-local-pwa/index.html?v=0.2.0`

The reset page clears only the app shell cache and service worker. It does not clear saved invoice data.
