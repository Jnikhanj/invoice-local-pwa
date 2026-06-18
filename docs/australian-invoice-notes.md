# Australian invoice notes

This app is configured for Australian invoice workflows.

Included fields:

- Invoice or Tax Invoice title
- Business name and ABN
- Client name and optional client ABN
- Invoice number, invoice date, due date
- Service or supply descriptions
- Quantity, rate, GST and total
- Payment details including BSB and account number

GST is calculated at 10% when GST is enabled.

ABN validation is a local format/checksum check only. It does not confirm whether the ABN is active or linked to the correct entity.
