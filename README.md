# BillBook — Hotel Billing Software

A complete, browser-based hotel billing and invoicing system. Runs entirely on GitHub Pages with no backend required. All data is stored in the browser's localStorage.

## Features

- **GST-compliant Tax Invoices** — CGST+SGST (intra-state) or IGST (inter-state), auto-calculated
- **Stay Details** — Check-in/check-out dates auto-calculate number of days
- **Live Invoice Preview** — See the invoice update in real time as you type
- **PDF Download** — Generate A4 PDF invoices with one click
- **Email Sending** — Send invoices via email using EmailJS (free tier: 200 emails/month)
- **Company Settings** — Upload logo, set hotel name, GSTIN, address, bank details
- **Invoice Management** — Dashboard with search, filter by status, sort
- **Data Backup** — Export/import all data as JSON

---

## Deploy to GitHub Pages

1. Push this repository to GitHub
2. Go to **Settings → Pages**
3. Under **Source**, select **Deploy from branch**
4. Choose **main** branch → **/ (root)** → click **Save**
5. Your site will be live at `https://YOUR-USERNAME.github.io/REPO-NAME/`

---

## First-Time Setup

1. Open the app and go to **Settings** (⚙️)
2. Upload your hotel logo
3. Fill in hotel name, GSTIN, and address
4. Set your default GST rate and invoice prefix
5. (Optional) Configure EmailJS for email sending

---

## Email Setup (EmailJS — Free)

1. Create a free account at [emailjs.com](https://www.emailjs.com)
2. **Add New Service** → connect Gmail, Outlook, or SMTP
3. **Email Templates → Create New Template**
4. Use these variables in your template body:

| Variable | Description |
|---|---|
| `{{to_email}}` | Customer email |
| `{{to_name}}` | Customer name |
| `{{from_name}}` | Hotel name |
| `{{invoice_no}}` | Invoice number |
| `{{invoice_date}}` | Invoice date |
| `{{due_date}}` | Due date |
| `{{amount}}` | Total amount |
| `{{room_ref}}` | Room number/reference |
| `{{check_in}}` | Check-in date |
| `{{check_out}}` | Check-out date |
| `{{hotel_address}}` | Hotel address |

5. Copy **Service ID**, **Template ID**, and **Public Key** into Settings → Email Settings
6. Click **Send Test Email** to verify

> **Note:** PDF attachment in email requires an EmailJS paid plan. Invoice details are always included inline in the email body.

---

## GST Rates for Hotel Accommodation (India)

| Room Tariff | GST Rate |
|---|---|
| ≤ ₹1,000/day | 0% (Exempt) |
| ₹1,001 – ₹7,500/day | 12% |
| > ₹7,500/day | 18% |

> The default is set to 5% to match your existing invoices. Change it in Settings.

---

## Technology

- Pure HTML, CSS, JavaScript — no build tools needed
- [html2pdf.js](https://github.com/eKoopmans/html2pdf.js) for PDF generation
- [EmailJS](https://www.emailjs.com) for client-side email
- localStorage for data persistence
