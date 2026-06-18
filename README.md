# InvoiceMate v0.3.0

Minimal Apple-style local invoice app for Australian invoices.

## What changed

- Rebuilt UI around Apple system fonts:
  `-apple-system`, `BlinkMacSystemFont`, `SF Pro Text`, `SF Pro Display`, `system-ui`.
- Minimal Swiss/document style.
- Removed pill-heavy UI.
- Added clean text tabs, square/small mark, line-based forms, and document-first invoice preview.
- Added appearance customisation:
  - Accent: Teal, Forest, Navy, Wine, Ochre, Black
  - Density: Compact, Comfortable, Large text
  - Invoice templates: Classic, Modern, Compact
- Local-first storage using browser localStorage.
- Australian conventions:
  - AUD formatting
  - ABN field and local checksum validation
  - BSB formatting
  - GST registered toggle
  - GST exclusive/inclusive calculations
  - 10% GST
- Print/PDF stylesheet.
- Cache reset page.

## Upload instructions

Upload the contents of this folder to the root of the GitHub Pages repository.

Then open:

`https://jnikhanj.github.io/invoice-local-pwa/reset-app-cache.html`

After it redirects, delete and re-add the Home Screen app if needed.
