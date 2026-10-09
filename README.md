# RR Metal Roofing — Quotation Module

> **Company:** ApexFlow Technologies  
> **Sprint:** Sprint 1 — Client Demo  
> **Developer:** Sasidaran S  
> **Source of Truth:** RR Metal Roofing Sprint 1 Brief (Confidential &bull; Internal)

A production-oriented quotation management web application built for RR Metal Roofing to configure products, build roofing quotations with automated sequence numbering, calculate exact amounts using arbitrary-precision arithmetic, enforce GST tax rules, and generate client-ready A4 PDF documents.

---

## 1. Technology Stack

- **Frontend Framework:** React 19 + TypeScript
- **Build Tool & Dev Server:** Vite 8
- **Styling:** Tailwind CSS v4
- **Backend & Cloud Services:** Firebase Web SDK (v12)
  - **Authentication:** Firebase Email/Password
  - **Database:** Cloud Firestore (Region: `asia-south1` Mumbai)
  - **Hosting:** Firebase Hosting (Single Page Application rewrite to `dist/index.html`)
- **Mathematical Precision Engine:** `decimal.js` (dedicated to all currency, dimension, and quantity calculations)
- **Unit Testing:** Vitest

---

## 2. Firebase Configuration Details

The Firebase project has been configured with the following production architecture:

| Component | Configuration | Note |
|---|---|---|
| **Project Name** | RR Metal Roofing | Project ID: `rr-metal-roofing` |
| **Authentication** | Email / Password | Enabled. **No public sign-up**. Users provisioned by administrator. |
| **Firestore Database** | Cloud Firestore | Region: **`asia-south1` (Mumbai)**. Cannot be changed later. |
| **Database Mode** | **Production mode** | Insecure test-mode rules (`allow read, write: if true;`) are strictly forbidden. |
| **Registered Web App** | `rr-metal-roofing-web` | App ID: `1:613442945602:web:7d572b3722355d3da623db` |
| **Hosting** | Firebase Hosting | Deploys Vite production build from `dist/` |

---

## 3. Environment Variables

Environment variables follow Vite's `VITE_` prefix convention.

### File Structure
- `.env.example`: Committed template showing all required environment variables.
- `.env.local`: Local file holding the actual credentials (ignored by Git, never committed).

### Variables Required

```env
VITE_FIREBASE_API_KEY=AIzaSyB8...
VITE_FIREBASE_AUTH_DOMAIN=rr-metal-roofing.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=rr-metal-roofing
VITE_FIREBASE_STORAGE_BUCKET=rr-metal-roofing.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=613442945602
VITE_FIREBASE_APP_ID=1:613442945602:web:7d572b3722355d3da623db
```

> **Security Note:** `.env.local` is strictly ignored in `.gitignore` to prevent any credentials from being committed to source control.

---

## 4. Project Directory Architecture

```
RR Metal Roofing/
├── .firebaserc                # Firebase CLI project binding (rr-metal-roofing)
├── firebase.json              # Firebase Hosting SPA config & Firestore rules mapping
├── firestore.rules            # Production security rules (role & active user checks)
├── .env.example               # Environment variables template
├── .env.local                 # Local development variables (git-ignored)
├── .gitignore                 # Git ignore configuration
├── package.json               # Dependencies and development scripts
├── tsconfig.json              # Root TypeScript solution configuration
├── tsconfig.app.json          # Strict TypeScript configuration for application code
├── tsconfig.node.json         # TypeScript configuration for Vite tooling
├── vite.config.ts             # Vite configuration with React, Tailwind, and path aliases
├── index.html                 # Single page application HTML root
├── public/                    # Static public assets
└── src/
    ├── app/
    │   ├── App.tsx            # Main application provider wrapper
    │   └── routes.tsx         # React Router v7 routing definitions
    ├── components/
    │   ├── auth/
    │   │   └── ProtectedRoute.tsx  # Auth guard (inactive / unprovisioned checks)
    │   ├── common/
    │   │   ├── LoadingSpinner.tsx  # Accessible loading spinner
    │   │   └── StatusBadge.tsx     # Role and status badge component
    │   └── layout/
    │       └── AppLayout.tsx       # Top bar, role indicator, navigation & footer
    ├── contexts/
    │   └── AuthContext.tsx    # Auth state, session persistence & profile loader
    ├── engine/
    │   └── index.ts           # Pure TypeScript calculation engine placeholder (decimal.js)
    ├── hooks/
    │   └── useAuth.ts         # Hook wrapper for AuthContext
    ├── lib/
    │   └── firebase.ts        # Firebase Web SDK initialization & env validation
    ├── pages/
    │   ├── auth/
    │   │   └── LoginPage.tsx  # Email/password authentication screen
    │   ├── dashboard/
    │   │   └── DashboardPage.tsx # Sprint 1 control overview
    │   ├── quotations/
    │   │   └── QuotationsPage.tsx
    │   ├── products/
    │   │   └── ProductsPage.tsx
    │   ├── customers/
    │   │   └── CustomersPage.tsx
    │   ├── settings/
    │   │   └── SettingsPage.tsx
    │   └── NotFoundPage.tsx
    ├── services/
    │   └── authService.ts     # Auth and user profile Firestore queries
    ├── tests/
    │   └── foundation.test.ts # Vitest suite verifying foundation setup
    ├── types/
    │   ├── counter.ts         # Quotation counter model
    │   ├── customer.ts        # Customer model
    │   ├── index.ts           # Types barrel export
    │   ├── product.ts         # Product model (sheets, pipes, pieces)
    │   ├── quotation.ts       # Quotation and snapshot line models
    │   ├── settings.ts        # Company settings model
    │   └── user.ts            # User profile and role types
    ├── index.css              # Global styles & Tailwind CSS v4 import
    ├── main.tsx               # Application bootstrap
    └── vite-env.d.ts          # Vite client types & environment interface
```

---

## 5. Development & Build Commands

All commands can be executed using `npm`:

```bash
# Install dependencies
npm install

# Start local Vite development server
npm run dev

# Run unit test suite
npm run test

# Type-check TypeScript without emitting output
npm run typecheck

# Build for production (Strict TypeScript check + Vite bundle)
npm run build

# Preview production build locally
npm run preview
```

---

## 6. Authentication & User Provisioning

Per the Sprint 1 Brief:
- **There is NO public sign-up or registration form.**
- User accounts are created by the administrator in **Firebase Console > Authentication**.
- For each authenticated user, a corresponding document must exist in Firestore:

```
Collection: users
Document ID: <UID from Firebase Auth>
Document Data:
{
  "name": "Sasidaran S",
  "email": "sasidaran@apexflowtechnologies.com",
  "role": "admin",        // "admin" or "sales"
  "active": true          // true or false
}
```

### Access Control Rules:
1. **`active === false`**: Application immediately denies access and informs the user their account has been deactivated.
2. **Missing `users/{uid}` document**: Application halts with a clear prompt directing the user to have their administrator provision the document.
3. **`role === 'admin'`**: Granted access to manage products, edit company settings, and create quotations.
4. **`role === 'sales'`**: Granted access to create quotations; prohibited from editing products or company settings both in the UI and at the database level via Firestore security rules.

---

## 7. Firestore Security Rules

Production rules are located in `firestore.rules`.

- **Closed by default:** `match /{document=**} { allow read, write: if false; }`
- **Users:** Authenticated users can read their own profile document (`request.auth.uid == userId`); only `admin` can write.
- **Products:** Only active users can read; only `admin` can create, update, or deactivate products. Sales writes from the browser console are rejected.
- **Quotations:** Active sales and admin users can read and create quotations.
- **Counter:** Client-side transaction on `counters/quotation` is strictly guarded by:
  `request.resource.data.next == resource.data.next + 1`
- **Company Settings:** Active users can read settings for PDF generation; only `admin` can modify them.

---

## 8. Deployment to Firebase Hosting

To deploy the application to Firebase Hosting:

1. Build the production bundle:
   ```bash
   npm run build
   ```
2. Deploy using Firebase CLI:
   ```bash
   firebase.cmd deploy --only hosting
   ```
   *(Or `firebase deploy --only hosting` on systems where script execution is enabled)*

---
