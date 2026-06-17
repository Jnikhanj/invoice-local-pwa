# InvoiceMate Local

InvoiceMate Local is a local-first, Safari-compatible invoice builder for Australian invoices.

It is designed for personal/business invoice creation without a server database, login, subscription, or cloud storage requirement.

## Current version

Version 0.1.0 includes:

- Australian invoice layout with Invoice / Tax Invoice title handling
- ABN field with local ABN checksum validation
- GST registered toggle
- GST exclusive and GST inclusive calculation modes
- 10% GST calculation
- Invoice numbering using INV-YYYY-0001 style
- Client details
- Business profile
- Bank payment details with BSB/account fields
- Draft, sent, paid, and overdue invoice statuses
- Local browser storage using IndexedDB
- Backup export/import as JSON
- Print/save-to-PDF layout for Safari
- PWA manifest and service worker shell

## Privacy

No invoice data is sent to any external service by this app. All invoice, client, and business profile data is intended to stay in the browser database unless you export it.

## Running locally

Open index.html in Safari for basic testing.

For best PWA/service worker testing, serve the folder through a local server or GitHub Pages.

## Roadmap

See docs/roadmap.md.
