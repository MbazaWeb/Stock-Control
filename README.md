# StockFlow

StockFlow is a React and Supabase application for stock distribution, sales capture, approval handling, audit visibility, and role-based team management.

It is designed for a field-sales hierarchy where stock moves from admin teams down to team leaders, captains, and DSRs, while sales and audit actions remain traceable by region and role.

## What the app does

StockFlow combines public stock visibility with protected operational workflows:

- Track inventory across zones, regions, team leaders, captains, and DSRs.
- Search stock by smartcard or serial number.
- Record direct sales and manager-submitted sales.
- Route submitted sales into an approval workflow before they become final records.
- Track unpaid items, no-package items, and unassigned stock.
- Manage team structure and login access for sales staff.
- Limit regional admins to their assigned regions.
- Run audit workflows and reporting across the sales hierarchy.
- Support CSV imports for master data and field-team records.
- Support PWA install and service-worker based offline shell behavior.
- Support OCR-assisted stock lookup through the scanner dialog.

## User roles

The application supports these authenticated roles in `admin_users`:

- `super_admin`: full system control.
- `admin`: central admin access across operational pages.
- `regional_admin`: restricted to assigned regions and limited user-management scope.
- `tsm`: territory-level dashboard and stock visibility for assigned regions.
- `team_leader`: manages team, stock, requests, and audits for their scope.
- `captain`: manager-level operational scope below team leader.
- `dsr`: direct sales representative with personal sales and approval submission workflow.

### Current access model

- Super admins and admins can access core admin operations.
- Regional admins are routed to the region-scoped dashboard and cannot access Zones & Regions.
- Regional admins can manage only team leader, captain, and DSR logins within assigned regions.
- Team leaders and captains use manager-oriented routes such as request submission and audit views.
- DSR users land on their own sales page and can submit sales for approval.

## Main application areas

### Public pages

- `/`: public dashboard.
- `/search`: stock search with scanner support.
- `/unpaid`: unpaid sales view.
- `/no-package`: no-package sales view.
- `/stock`: unassigned stock view.
- `/add-sale`: public sale submission flow.
- `/dsrs`: public DSR directory.

### Admin pages

- `/admin`: role-aware landing page.
- `/admin/inventory`: inventory management.
- `/admin/assign-stock`: stock assignment workflow.
- `/admin/record-sales`: direct record-sales workflow for non-DSR admin users.
- `/admin/sales-team`: team structure and sales-team management.
- `/admin/zones-regions`: zones and regions management.
- `/admin/reports`: sales reporting.
- `/admin/sales-management`: operational sales management.
- `/admin/search`: admin search tools.
- `/admin/global-import`: bulk import workflows.
- `/admin/sales-approval`: approval queue for pending sales.
- `/admin/regional-admins`: user and login management for scoped sales roles.
- `/admin/settings`: account and app settings.
- `/admin/tsm-team`: TSM team view.
- `/admin/tsm-stock`: TSM stock visibility.
- `/admin/tl-team`: team leader and captain team management.
- `/admin/tl-stock`: assigned stock for managers.
- `/admin/tl-sales`: DSR sales page and DSR sale submission flow.
- `/admin/tl-unpaid`: team leader unpaid view.
- `/admin/tl-no-package`: team leader no-package view.
- `/admin/sale-requests`: manager request tracking.
- `/admin/audits`: audit views for admin and manager roles.

## Key workflows

### Inventory flow

1. Inventory is imported or created.
2. Stock is assigned through the hierarchy.
3. Search and dashboard pages expose current status.
4. Sold or pending items are excluded from available assignment and sale-submission lists.

### Sales flow

There are two sales patterns in the codebase:

- Direct recorded sales in `sales_records` for privileged operational users.
- Approval-based sales using `pending_sales`.

Approval-based flow:

1. A manager, captain, or DSR submits a sale request.
2. The request is inserted into `pending_sales`.
3. Admins review it in Sales Approval.
4. On approval, the record is finalized into `sales_records` and inventory state is updated.
5. On rejection, the pending request remains traceable with rejected status.

### DSR approval flow

The DSR page now supports:

- viewing approved personal sales;
- selecting currently assigned stock;
- entering sale date, customer name, payment status, package status, and notes;
- submitting a request for approval;
- viewing recent request statuses.

### User-management flow

Managed logins are created through the Users Page and linked into `admin_users`.

Current implementation includes:

- normalized email handling;
- duplicate login checks for email, team leader, captain, and DSR links;
- reuse of an existing Supabase Auth user when the email already exists and the supplied password matches;
- DSR login linkage by `dsr_id` instead of incorrectly consuming the unique `captain_id` slot.

## Architecture overview

### Frontend

- React 18
- TypeScript with strict mode enabled
- Vite 7
- React Router 6
- TanStack Query
- Tailwind CSS
- shadcn/ui with Radix UI primitives
- Lucide icons
- Sonner and shadcn toast components

### Backend and data

- Supabase Auth for sign-in and session handling
- Supabase PostgREST queries via `@supabase/supabase-js`
- SQL migrations under `supabase/migrations`
- Role-aware access and scope loading in the auth provider

### Deployment

- Vercel static build deployment
- SPA fallback routing through `vercel.json`
- PWA manifest in `public/manifest.json`
- service worker registration in `src/main.tsx`

## Infrastructure and database notes

### Required environment variables

Create a `.env` file in the project root with:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

The app throws at startup if either variable is missing.

### Supabase project

The local Supabase configuration currently references this project id in `supabase/config.toml`:

```toml
project_id = "jaovvaweypydoyfevzct"
```

### Important schema areas

Key tables used by the app include:

- `admin_users`
- `admin_region_assignments`
- `zones`
- `regions`
- `team_leaders`
- `captains`
- `dsrs`
- `inventory`
- `sales_records`
- `pending_sales`
- `audits`

### Migrations included in the repository

The repository already contains migrations for:

- base database import and initial schema;
- pending sales creation;
- extra DSR fields;
- linking admin users to team leaders;
- audit and staff login relationships;
- role expansion for sales staff;
- sale completion status;
- pending sale submitter tracking;
- audit expansion across sales roles;
- admin-region assignment policy hardening;
- manager permissions over team records;
- TSM role support;
- admin user name column support.

## Authentication and role resolution

`AuthProvider` in `src/hooks/useAuth.tsx` loads:

- the authenticated Supabase session;
- the linked `admin_users` row;
- assigned regions for `regional_admin` and `tsm`;
- team leader, captain, or DSR profile details for scoped roles.

Role-specific landing behavior:

- `tsm` and `regional_admin` users land on the TSM/regional dashboard.
- `team_leader` and `captain` users land on the manager dashboard.
- `dsr` users land on the DSR sales page.
- central admins land on the main admin dashboard.

## Project structure

```text
Stocky-main/
|-- public/
|   |-- manifest.json
|   |-- sw.js
|   `-- templates/
|-- src/
|   |-- components/
|   |   |-- layout/
|   |   `-- ui/
|   |-- hooks/
|   |-- integrations/
|   |   `-- supabase/
|   |-- lib/
|   |-- pages/
|   |   |-- admin/
|   |   `-- public route pages
|   |-- App.tsx
|   |-- index.css
|   `-- main.tsx
|-- supabase/
|   |-- config.toml
|   |-- fix_login.sql
|   |-- setup_new_project.sql
|   `-- migrations/
|-- vercel.json
|-- vite.config.ts
|-- tailwind.config.ts
`-- package.json
```

## Important source folders

- `src/components/layout`: admin and public shells, sidebar, navigation.
- `src/components/ui`: reusable UI primitives.
- `src/hooks`: auth, PWA, toast, responsive helpers.
- `src/lib`: utility helpers such as date-range and validation logic.
- `src/pages`: public-facing pages.
- `src/pages/admin`: protected operational modules.
- `src/integrations/supabase`: generated types and Supabase client.
- `supabase/migrations`: schema evolution and policy changes.

## Feature highlights by module

### Inventory and search

- inventory tracking and assignment
- search by smartcard and serial number
- scanner dialog with OCR support
- stock-state visibility across assigned, sold, unpaid, and pending states

### Sales operations

- direct sale recording
- pending sale approval workflow
- DSR submission-to-approval flow
- unpaid and no-package monitoring
- completion status labeling

### Team and access management

- team leader, captain, and DSR relationship mapping
- regional assignment scoping
- managed login creation in `admin_users`
- sales-role access restrictions by route and sidebar visibility

### Imports and exports

- CSV templates under `public/templates`
- global import workflow for bulk data loading
- Excel and PDF related dependencies are present for reporting/export features

### PWA and install behavior

- web app manifest
- service worker registration
- install banner component
- mobile-friendly operational UI

## Development setup

### Prerequisites

- Node.js 20 or newer recommended
- npm available locally
- Supabase project and anon key

### Install

```bash
git clone <your-repository-url>
cd Stocky-main
npm install
```

### Start development server

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

### Preview the production build

```bash
npm run preview
```

### Lint

```bash
npm run lint
```

## Deployment on Vercel

`vercel.json` is configured for a static build:

- build source: `package.json`
- output directory: `dist`
- SPA fallback: all unmatched routes resolve to `index.html`

That means direct deep links such as `/admin/sales-approval` continue to work after deployment.

## Operational notes

- The codebase uses strict TypeScript settings.
- The app expects Supabase RLS and helper policies from the included migrations.
- Regional admin behavior depends on valid `admin_region_assignments` data.
- DSR login behavior depends on correct `admin_users.dsr_id` linkage.
- Pending sale approval depends on both `pending_sales` and `sales_records` being consistent.

## Recommended onboarding steps for a new environment

1. Create or connect the Supabase project.
2. Apply the SQL schema and migrations in order.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Seed zones, regions, team leaders, captains, DSRs, and inventory.
5. Create initial admin users.
6. Run the app locally and verify login, stock search, and approval flow.

## Repository status

This README reflects the current application behavior in the repository, including:

- regional-admin scoped access;
- TSM and regional dashboard behavior;
- DSR sale submission for approval;
- users-page login management and conflict handling;
- Supabase-backed pending sales and audit workflows.
