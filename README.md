<div align="center">

<a href="https://protakeoff.org">
  <img src="public/prologo.svg" alt="ProTakeoff AI Logo - Open Source Construction Estimating Software" width="200"/>
</a>

# ProTakeoff
### Free & Open Source Construction Estimating & Takeoff Software[[1](https://www.google.com/url?sa=E&q=https%3A%2F%2Fprotakeoff.org)]

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](https://opensource.org/licenses/MIT)
![Version](https://img.shields.io/badge/version-0.1.0-blue?style=for-the-badge)
![Status](https://img.shields.io/badge/status-active-success?style=for-the-badge)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge)](http://makeapullrequest.com)

<div align="center">
  
  [![Tauri](https://img.shields.io/badge/Tauri-2.0-24C8D5?style=flat&logo=tauri&logoColor=white)](https://tauri.app/)
  [![React](https://img.shields.io/badge/React-19-61DAFB?style=flat&logo=react&logoColor=black)](https://react.dev/)
  [![Rust](https://img.shields.io/badge/Rust-1.77+-000000?style=flat&logo=rust&logoColor=white)](https://www.rust-lang.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.0-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
  [![TailwindCSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=flat&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

</div>

_A lightning-fast, local-first alternative to expensive bidding software._
<br/>
_Measure PDF blueprints, calculate costs, and manage bids—free forever._

<br />

<!-- Download Badges -->
[![Download for macOS](https://img.shields.io/badge/Download-macOS-white?style=for-the-badge&logo=apple&logoColor=black)](https://github.com/ilirkl/protakeoff-ai3/releases/latest)
[![Download for Windows](https://img.shields.io/badge/Download-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/ilirkl/protakeoff-ai3/releases/latest)
[![Download for Linux](https://img.shields.io/badge/Download-Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black)](https://github.com/ilirkl/protakeoff-ai3/releases/latest)

<br />

[🌐 Website](https://protakeoff.org) • [View Demo](#) • [Report Bug](https://github.com/ilirkl/protakeoff-ai3/issues) • [Request Feature](https://github.com/ilirkl/protakeoff-ai3/issues)

</div>

---

## 📑 Table of Contents
- [Overview](#-overview)
- [Why ProTakeoff?](#-why-protakeoff)
- [Key Features](#-key-features)
- [Screenshots](#-screenshots)
- [Tech Stack](#-tech-stack)
- [Getting Started](#-getting-started)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🚀 Overview

**ProTakeoff** is a cutting-edge, open-source **construction estimating** and **quantity takeoff (QTO)** tool designed to streamline the bidding process for contractors. Built with **Tauri**, **React**, and **Rust**, it combines the raw performance of a native desktop application with the flexibility of modern web technologies.

Most estimating software is expensive, cloud-dependent, and bloated. ProTakeoff is different. Whether you are a general contractor, flooring specialist, or a DIY enthusiast, ProTakeoff provides a **free** and **private** way to calculate materials, labor, and costs with pixel-perfect precision directly from your PDF plans.

## 💡 Why ProTakeoff?
- **💰 Free & Open Source:** Stop paying monthly subscriptions for basic takeoff tools.
- **⚡ Local-First Speed:** Powered by Rust and SQLite. Opens large blueprint PDFs instantly. No internet required.
- **🔒 Privacy Focused:** Your data stays on your machine. We don't mine your bid data.
- **🛠 Infinite Customization:** Define your own formulas (JavaScript syntax) and assemblies.

## ✨ Key Features

### 📐 Digital Quantity Takeoffs
Perform accurate measurements directly on your PDF blueprints.
- **Area & Square Footage:** Perfect for flooring, roofing, drywall, and concrete slabs.
- **Linear Footage:** Measure walls, trimming, curbing, and piping.
- **Item Counts:** Track fixtures, outlets, drains, and columns.
- **Canvas Tools:** Pan, zoom, and snap-to-lines for high-precision tracing.

### 💰 Professional Estimating & Bidding
Turn your takeoff measurements into professional bids.
- **Smart Assemblies:** Build complex items (e.g., a "Wall" assembly that automatically calculates studs, insulation, drywall, and paint based on one linear measurement).
- **Excel-like Formulas:** Use built-in math functions (`Math.ceil`, `Math.max`) to automate waste factors and pricing.
- **Material & Labor:** Separate material costs from labor hours for accurate profit analysis.

### 📄 PDF Plan Management
- **Visual Plan Organizer:** Drag-and-drop plan management.
- **Custom Scaling:** Calibrate each page to its specific scale (e.g., 1/4" = 1').
- **High-Performance Rendering:** Smooth scrolling even on 100+ page architectural sets.

### 📤 Reports & Export
- **Client Proposals:** Generate professional PDF quotes.
- **Excel/CSV Export:** Export raw data to connect with QuickBooks, Xero, or other accounting tools.

## 📸 Screenshots

<div align="center">

> [!NOTE]
> **Takeoff Canvas**  
> *Perform precise area and linear measurements on blueprints.*  
> `![Construction Takeoff Canvas measuring square footage on PDF](assets/takeoff-screenshot.png)`

> [!NOTE]
> **Estimating View**  
> *Manage line items, unit costs, and material assemblies.*  
> `![Construction Estimating Software Interface showing costs and formulas](assets/estimating-screenshot.png)`

</div>

## 🛠 Tech Stack

ProTakeoff is engineered for performance using the "T3" (Tauri, TypeScript, Tailwind) architecture:

| Component | Technology | Why we chose it |
|-----------|------------|-------------|
| **Frontend** | React 19, TypeScript, TailwindCSS | Type-safe, responsive, and modern UI. |
| **Backend** | Rust, Tauri v2 | Extremely small bundle size (<10MB) and native speed. |
| **Database** | SQLite | Robust local data storage without server latency. |
| **Build Tool** | Vite | Instant HMR and optimized production builds. |

## 📦 Getting Started

### Prerequisites
- **Node.js** (v18+)
- **Rust** (Stable)
- **pnpm** (recommended) or **npm**

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ilirkl/protakeoff-ai3.git
   cd protakeoff-ai3
   ```

---

## ✍️ DocuSign Integration (sandbox)

ElectraScan can send estimates out for signature via DocuSign's demo environment. The signing flow runs through a Supabase Edge Function so the RSA private key never reaches the browser.

### One-time setup

1. **Grant consent** (only required the first time the integration key is used). Open this URL in a browser while signed into your DocuSign demo account and click **Accept**:

   ```
   https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature%20impersonation&client_id=9862c9dd-5aef-4595-afbe-3f5a8927eac1&redirect_uri=https://electrascan-app.vercel.app/api/docusign/callback
   ```

2. **Set the private key as a Supabase secret** (do not commit the PEM):

   ```bash
   npx supabase secrets set DOCUSIGN_PRIVATE_KEY="$(cat ~/.openclaw/workspace/docusign_private.pem)"
   ```

3. **Deploy the edge function**:

   ```bash
   npx supabase functions deploy docusign-envelope
   ```

### Endpoints used

| Purpose | URL |
|---------|-----|
| OAuth (JWT Bearer Grant) | `https://account-d.docusign.com/oauth/token` |
| eSignature REST API      | `https://demo.docusign.net/restapi/v2.1` |

### Client usage

```ts
import { sendEstimateForSigning } from "./services/docusignService";

const result = await sendEstimateForSigning({
  signerEmail: "client@example.com",
  signerName: "Pat Client",
  estimateRef: "EST-0042",
  projectName: "Smith Residence",
  estimateValue: 18750,
  documentBase64, // base64-encoded PDF (no data URL prefix)
});

if (result.ok) {
  console.log("Envelope sent:", result.envelopeId, result.status);
} else {
  console.error("DocuSign error:", result.error);
}
```

The edge function caches the JWT-issued access token in module memory and refreshes it when within 60s of expiry. Sandbox identifiers (Integration Key, API Account ID, User ID) are hardcoded in `supabase/functions/docusign-envelope/index.ts` — replace them before pointing at production.