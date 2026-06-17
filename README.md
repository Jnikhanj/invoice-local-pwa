# InvoiceMate Local

InvoiceMate Local is a local-first, Safari-compatible invoice builder for Australian invoices.

## Version 0.1.4

This zip includes the iOS Home Screen layout fix:

- iOS status bar changed from translucent to non-translucent black.
- Added `styles/mobile-fix.css`.
- Added safe-area padding for iPhone Home Screen mode.
- Prevented horizontal overflow on iPhone.
- Added cache-busting query strings and service worker cache version `0.1.4`.

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

`https://jnikhanj.github.io/invoice-local-pwa/?v=0.1.4`

For iPhone Home Screen, delete the old icon first, clear Safari website data for `github.io`, then add the app again.
