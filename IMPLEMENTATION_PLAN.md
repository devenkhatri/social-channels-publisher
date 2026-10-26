# Social Channels Publisher — Implementation Plan

## 1. Project Overview

A **Next.js (React + TypeScript)** full-stack application that:
1. Connects to **Microsoft OneDrive** to read content folders
2. Extracts content (videos, PDFs, markdown text, vector/slide images) from each folder
3. Maps content to **5 social channels**: LinkedIn, YouTube, Instagram, Facebook, and Skool
4. Allows per-channel content editing with a rich text editor
5. Publishes to channels via the **Zernio API** (Skool is manual copy-paste)
6. Supports **multiple Zernio accounts** with profile discovery
7. Tracks publishing status per channel per content folder
8. Supports both **immediate publishing** and **scheduled publishing**
9. **OneDrive Folder Status & Lifecycle (`-Done` suffix)**:
   - Folders without `-Done` suffix (e.g., `20261026-0823`) are treated as **Unpublished** (active pending content).
   - Folders with `-Done` suffix (e.g., `20261026-0823-Done`) are recognized as **Published**.
   - Upon successful publishing across all target channels (or via "Publish & Mark Done"), the app automatically renames the OneDrive folder by appending `-Done` via the Microsoft Graph API.

---

## 2. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Framework | **Next.js 14+ (App Router)** | Full-stack with API routes, SSR, TypeScript |
| Language | **TypeScript** | Type safety across front and back |
| Styling | **Tailwind CSS v4** + **shadcn/ui** | Rapid, polished UI components |
| Database | **SQLite** (via **Drizzle ORM**) | Zero-config, file-based, portable |
| Auth | **Simple password protection** | Single admin password, session cookie |
| OneDrive | **Microsoft Graph API** (OAuth 2.0, delegated) | User signs in, app gets delegated access |
| Social Publishing | **Zernio API** (`https://zernio.com/api/v1`) | Unified API for LinkedIn, YouTube, Instagram, Facebook |
| Rich Text Editor | **TipTap** or **React-Quill** | Full rich text editing with preview |
| State Management | **React Query (TanStack Query)** | Server state, caching, mutations |

---

## 2.1 Design Principles

### Professional UI/UX — No AI-Slop

The application must feel like a **hand-crafted SaaS product**, not a generic AI-generated template:

1. **Intentional visual hierarchy** — Every screen has a clear focal point, logical reading order, and purposeful use of whitespace. No cluttered layouts or randomly placed components.
2. **Consistent design language** — Unified color palette, typography scale (Inter or similar professional typeface), spacing system (4px/8px grid), and component patterns across all pages.
3. **Meaningful interactions** — Subtle transitions, skeleton loading states, toast notifications, and hover/focus states that feel responsive and polished. No jarring page reloads or empty-state voids.
4. **Data-dense without being overwhelming** — Dashboard and content browser pack useful information without visual noise. Tables, cards, and stats use progressive disclosure.
5. **Real empty states** — Onboarding-friendly empty states with clear CTAs instead of blank pages when no content is synced or no accounts are configured.
6. **Accessible by default** — Proper contrast ratios, keyboard navigation, focus rings, and screen-reader labels.

### Mobile-First Responsive Design

All layouts are designed **mobile-first** and progressively enhanced for larger screens:

| Breakpoint | Behavior |
|---|---|
| **Mobile** (< 640px) | Single-column layout, bottom navigation, stacked cards, collapsible sections, full-width editors |
| **Tablet** (640px–1024px) | Two-column where beneficial, sidebar as overlay drawer, tabbed content editor |
| **Desktop** (> 1024px) | Full sidebar navigation, side-by-side editor + preview, multi-column dashboard grid |

- Navigation: Bottom tab bar on mobile → collapsible sidebar on desktop
- Content cards: Single-column stack on mobile → 2-3 column grid on desktop
- Content editor: Stacked editor/preview on mobile → side-by-side on desktop
- Settings: Full-width forms on mobile → centered constrained-width on desktop
- All touch targets minimum 44×44px on mobile

---

## 3. Zernio API Summary (from research)

### 3.1 Authentication
- **Header**: `Authorization: Bearer <ZERNIO_API_KEY>`
- Each Zernio account has its own API key
- Profiles (connected social accounts) are discovered per API key

### 3.2 Media Upload Flow
```
POST /v1/media/presign
Body: { "filename": "video.mp4", "contentType": "video/mp4" }
Response: { "uploadUrl": "...", "publicUrl": "...", "key": "...", "expiresIn": 3600 }

Then: PUT <binary file> → uploadUrl
Then: Use publicUrl in post creation
```

### 3.3 Create Post
```
POST /v1/posts
Headers:
  Authorization: Bearer <token>
  Idempotency-Key: <uuid>  (recommended)

Body: {
  "platforms": [
    { "platform": "linkedin", "accountId": "..." }
  ],
  "content": "Post text here...",
  "mediaUrls": ["https://...publicUrl..."],
  "publishNow": true | false,
  "scheduledFor": "2026-11-01T10:00:00Z",  // if scheduling
  "isDraft": false
}
```

### 3.4 Platform Identifiers & Post Types

| Platform | Key | Supported Post Types |
|---|---|---|
| LinkedIn | `linkedin` | Text, Image, Video, **Document/PDF carousel**, Poll |
| YouTube | `youtube` | Video, Shorts (with title, description, tags, visibility) |
| Instagram | `instagram` | Feed Post, **Carousel** (multi-image), Stories, **Reels** |
| Facebook | `facebook` | Feed Post, Multi-image, Link Carousel, Stories, **Reels** |
| Skool | — | Manual (copy-paste from app) |

---

## 4. OneDrive Content Folder Structure & Lifecycle

```
📁 Selected Parent Folder (on OneDrive)
├── 📁 20261026-0823/ (Unpublished — no "-Done" suffix)
│   ├── 📄 caption.md                 → YouTube description, Instagram caption, Facebook text
│   ├── 📄 linkedin-post.md           → LinkedIn post text
│   ├── 📄 skool-post.md              → Skool post text (manual copy-paste)
│   ├── 📄 cover-prompt.md            → Cover prompt metadata (viewable in app)
│   ├── 🖼️ cover.svg                  → Main cover visual / post thumbnail
│   ├── 🎬 code-moats-hyperframes.mp4 → YouTube video + Instagram Reel + Facebook Reel
│   ├── 🎬 code-moats.mp4             → Alternative video asset
│   ├── 📑 code-moats.pdf             → LinkedIn native document carousel
│   └── 📁 slides/                    → Pre-generated individual slide files
│       ├── 🖼️ code-moats-slide-1.svg
│       ├── 🖼️ code-moats-slide-2.svg
│       ├── 🖼️ ...
│       └── 🖼️ code-moats-slide-16.svg
├── 📁 20261025-1420-Done/ (Published — ends with "-Done")
│   └── ...
└── ...
```

### 4.1 Folder Publishing Lifecycle & The `-Done` Suffix

1. **Unpublished Folders**: Folders **without** the `-Done` suffix (e.g., `20261026-0823`) represent unpublished content. These are surfaced by default in the dashboard and content browser.
2. **Published Folders**: Folders ending with `-Done` (e.g., `20261026-0823-Done`) are recognized as already published.
3. **Automated Rename on Publish**:
   - Once content is published to all targeted channels (or when the user clicks **"Publish All & Mark Done"** or **"Mark as Published"**):
   - The app makes a call to Microsoft Graph API: `PATCH /me/drive/items/{id}` with `{ "name": "<folder_name>-Done" }`.
   - The database updates `folder_name` and sets `is_done = 1`.
   - The user can also toggle "Auto-rename OneDrive folder to -Done" in settings.

### 4.2 Content Extraction Rules

| Source File / Folder | Extraction / Handling | Used For |
|---|---|---|
| `caption.md` | First `# Heading` → **Title**; remaining body → **Description** | YouTube (title + description), Instagram (caption), Facebook (post text) |
| `linkedin-post.md` | First `# Heading` → **Title**; remaining body → **Description** | LinkedIn post text |
| `skool-post.md` | First `# Heading` → **Title**; remaining body → **Description** | Skool (manual copy-paste with one-click copy) |
| `cover-prompt.md` | Raw text | Informational modal / prompt reference in editor |
| `cover.svg` | SVG vector image | Dashboard card thumbnail & preview cover |
| `*-hyperframes.mp4` | Video file (`code-moats-hyperframes.mp4`) | YouTube (video upload), Instagram (Reel/Video), Facebook (Reel/Video) |
| `*.pdf` | PDF document (`code-moats.pdf`) | LinkedIn (native document/carousel post — uploaded directly) |
| `slides/*-slide-{n}.svg` (or `.png`/`.jpg`) | Slide files in `slides/` subfolder | Instagram Carousel & Facebook Carousel |

### 4.3 Slide Processing & Natural Ordering

- **No PDF-to-Image Conversion Needed**: All slides are already produced as individual slide files inside the `slides/` subfolder.
- **Natural Numeric Sorting**: Slide filenames like `*-slide-1.svg` through `*-slide-16.svg` are sorted using natural numeric comparison (`slide-1`, `slide-2`, ... `slide-9`, `slide-10`, `slide-16`) so slide 10 does not precede slide 2.
- **Vector-to-Raster (SVG to PNG) Handling**:
  - While LinkedIn accepts the native PDF directly, Instagram and Facebook Graph APIs require raster images (`image/jpeg` or `image/png`).
  - Because slides are stored as clean `.svg` vectors, the backend media preparation layer rasterizes SVG slides to crisp, high-resolution PNGs (1080×1350 for 4:5 portrait or 1080×1080 for 1:1) in memory using fast native `@resvg/resvg-js` before uploading to Zernio presigned URLs.
  - If `.png` or `.jpg` slides are present instead of SVG, they are used directly without transformation.

### 4.4 Per-Channel Content Mapping

| Channel | Text Source | Media Asset | Post Type |
|---|---|---|---|
| **YouTube** | `caption.md` (Title → video title, body → description) | `*-hyperframes.mp4` | Video upload |
| **LinkedIn** | `linkedin-post.md` | `*.pdf` (uploaded directly as document) | Document / PDF carousel post |
| **Instagram** | `caption.md` (body → caption) | `*-hyperframes.mp4` **OR** `slides/*.svg` (rasterized to PNG carousel) | User choice: Reel vs Multipage Carousel |
| **Facebook** | `caption.md` (body → post text) | `*-hyperframes.mp4` **OR** `slides/*.svg` (rasterized to PNG carousel) | User choice: Reel vs Multipage Carousel |
| **Skool** | `skool-post.md` (Title & body) | None (or cover image) | Manual copy-paste with clipboard button |

---

## 5. Database Schema (SQLite via Drizzle ORM)

```sql
-- App settings (key-value store for OneDrive config, admin password, etc.)
CREATE TABLE settings (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Zernio accounts
CREATE TABLE zernio_accounts (
  id          TEXT PRIMARY KEY,  -- UUID
  name        TEXT NOT NULL,     -- Display name (e.g., "Main Account", "Client X")
  api_key     TEXT NOT NULL,     -- Encrypted Zernio API key
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Discovered Zernio profiles (social accounts connected to a Zernio account)
CREATE TABLE zernio_profiles (
  id              TEXT PRIMARY KEY,  -- UUID
  zernio_account_id TEXT NOT NULL REFERENCES zernio_accounts(id) ON DELETE CASCADE,
  platform        TEXT NOT NULL,     -- 'linkedin' | 'youtube' | 'instagram' | 'facebook'
  profile_id      TEXT NOT NULL,     -- Zernio's profile/account ID
  profile_name    TEXT,              -- Display name from Zernio
  profile_avatar  TEXT,              -- Avatar URL
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Content items (each OneDrive folder becomes one content item)
CREATE TABLE content_items (
  id                  TEXT PRIMARY KEY,  -- UUID
  folder_name         TEXT NOT NULL,     -- Current OneDrive folder name (e.g. "20261026-0823" or "20261026-0823-Done")
  original_folder_name TEXT NOT NULL,    -- Base folder name without "-Done" suffix
  folder_path         TEXT NOT NULL,     -- Full OneDrive path
  drive_item_id       TEXT NOT NULL,     -- OneDrive Drive Item ID (immutable across renames)
  is_done             INTEGER NOT NULL DEFAULT 0, -- 1 = published (-Done suffix present), 0 = unpublished
  title               TEXT,              -- Extracted title from .md
  cover_image         TEXT,              -- OneDrive item ID or path to cover.svg / cover image
  slide_count         INTEGER DEFAULT 0, -- Number of slide files discovered in slides/
  synced_at           DATETIME,          -- Last sync from OneDrive
  renamed_at          DATETIME,          -- When folder was renamed to -Done on OneDrive
  created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Per-channel content (editable text + publish config per channel per content item)
CREATE TABLE channel_posts (
  id                TEXT PRIMARY KEY,  -- UUID
  content_item_id   TEXT NOT NULL REFERENCES content_items(id) ON DELETE CASCADE,
  channel           TEXT NOT NULL,     -- 'linkedin' | 'youtube' | 'instagram' | 'facebook' | 'skool'
  title             TEXT,              -- Editable title (initially auto-extracted)
  body              TEXT,              -- Editable body (initially auto-extracted from .md)
  media_type        TEXT,              -- 'video' | 'pdf' | 'video_reel' | 'carousel' | null
  post_type         TEXT,              -- Platform-specific: 'reel' | 'video' | 'document' | 'carousel' | 'feed'
  zernio_account_id TEXT REFERENCES zernio_accounts(id),  -- Selected Zernio account
  zernio_profile_id TEXT REFERENCES zernio_profiles(id),  -- Selected profile
  status            TEXT NOT NULL DEFAULT 'draft',  -- 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed'
  scheduled_for     DATETIME,         -- If scheduled
  published_at      DATETIME,
  zernio_post_id    TEXT,             -- Post ID returned by Zernio
  error_message     TEXT,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- OneDrive OAuth tokens
CREATE TABLE oauth_tokens (
  id            TEXT PRIMARY KEY,
  provider      TEXT NOT NULL,     -- 'microsoft'
  access_token  TEXT NOT NULL,
  refresh_token TEXT,
  expires_at    DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

---

## 6. Application Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js App Router                     │
├──────────────────┬──────────────────────────────────────┤
│   Frontend (UI)  │          API Routes (/api/...)        │
│                  │                                       │
│  ┌────────────┐  │  ┌─────────────┐  ┌───────────────┐  │
│  │ Dashboard  │  │  │ /api/auth   │  │ /api/settings │  │
│  │ Content    │  │  │ /api/onedrive│ │ /api/zernio   │  │
│  │ Editor     │  │  │ /api/content│  │ /api/publish  │  │
│  │ Settings   │  │  │ /api/sync   │  │ /api/profiles │  │
│  └────────────┘  │  └─────┬───────┘  └──────┬────────┘  │
│                  │        │                  │           │
│                  │  ┌─────▼──────────────────▼────────┐  │
│                  │  │        Service Layer             │  │
│                  │  │  OneDriveService                 │  │
│                  │  │  ZernioService                   │  │
│                  │  │  ContentExtractor                │  │
│                  │  │  MediaUploader                   │  │
│                  │  │  PublishOrchestrator             │  │
│                  │  └─────┬───────────────────┬───────┘  │
│                  │        │                   │          │
│                  │  ┌─────▼─────┐  ┌──────────▼───────┐ │
│                  │  │  SQLite   │  │ External APIs    │ │
│                  │  │  (Drizzle)│  │ • MS Graph       │ │
│                  │  │           │  │ • Zernio API     │ │
│                  │  └───────────┘  └──────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Page / Route Structure

```
/                           → Dashboard (content list + quick actions)
/content                    → Content browser (all synced content folders)
/content/[id]               → Content detail + per-channel editor
/content/[id]/[channel]     → Channel-specific edit view with preview
/settings                   → App settings page
/settings/onedrive          → OneDrive connection + folder selector
/settings/zernio            → Zernio accounts management
/auth/login                 → Admin login page
/auth/microsoft/callback    → Microsoft OAuth callback
```

---

## 8. Feature Breakdown & Implementation Phases

### Phase 1: Project Scaffolding & Core Setup
**Estimated effort: 1-2 days**

- [x] Initialize Next.js 14+ (Next.js 16) project with TypeScript, App Router & Turbopack
- [x] Configure Tailwind CSS v4 styling & layout primitives
- [x] Set up Drizzle ORM + SQLite database with WAL pragma
- [x] Create database schema (settings, accounts, profiles, content_items, channel_posts, tokens)
- [x] Implement simple password authentication (Next.js 16 proxy + HTTP-only session cookie)
- [x] Create base layout (sidebar navigation, mobile bottom nav, header, main content area)
- [x] Set up environment variables structure (.env.example, .env.local)

**Key files:**
```
src/
├── app/
│   ├── layout.tsx                 # Root layout with sidebar
│   ├── page.tsx                   # Dashboard
│   ├── auth/login/page.tsx        # Login page
│   └── api/auth/route.ts          # Auth API
├── db/
│   ├── schema.ts                  # Drizzle schema
│   ├── index.ts                   # DB connection
│   └── migrations/                # SQL migrations
├── lib/
│   ├── auth.ts                    # Auth helpers
│   └── config.ts                  # App config
└── components/
    ├── ui/                        # shadcn/ui components
    ├── layout/                    # Sidebar, Header, etc.
    └── ...
```

---

### Phase 2: OneDrive Integration
**Estimated effort: 2-3 days**

- [x] Register Azure AD application (App Registration) configuration support in UI & .env
  - Redirect URI: `http://localhost:3000/auth/microsoft/callback`
  - API Permissions: `Files.ReadWrite`, `Files.ReadWrite.All`, `User.Read` *(ReadWrite permission is required to rename folders to `-Done` upon publishing)*
- [x] Implement Microsoft OAuth 2.0 flow
  - `GET /api/onedrive/auth` → redirect to Microsoft login
  - `GET /auth/microsoft/callback` → exchange code for tokens
  - Store tokens in `oauth_tokens` table (AES-256-GCM encrypted)
  - Token refresh logic (auto-refresh on expiry)
- [x] Implement OneDrive folder browsing
  - `GET /api/onedrive/folders` → list root-level folders
  - `GET /api/onedrive/folders?parentId={id}` → list subfolders
  - Folder picker component (interactive drilldown with breadcrumbs and search)
- [x] Implement parent folder selection and persistence
  - Save selected folder ID + path in `settings` table (`POST /api/onedrive/select-folder`)
- [x] Implement OneDrive folder rename service
  - Function: `renameFolder(driveItemId: string, newName: string)`
  - Calls Graph API `PATCH /me/drive/items/{id}` with `{ "name": newName }` (`POST /api/onedrive/rename`)
- [x] Settings page UI for OneDrive connection
  - Connection status indicator & user profile
  - Folder picker modal
  - Disconnect button
  - Azure App Registration credentials manager
  - Auto-rename to "-Done" lifecycle toggle

**Microsoft Graph API endpoints used:**
```
GET /me/drive/root/children         → list root folders
GET /me/drive/items/{id}/children   → list children of folder
GET /me/drive/items/{id}/content    → download file content
GET /me/drive/items/{id}            → get item metadata
PATCH /me/drive/items/{id}          → rename folder (append "-Done" on publish)
```

---

### Phase 3: Content Sync & Extraction
**Estimated effort: 2-3 days**

- [ ] Content sync service
  - `POST /api/sync` → trigger full sync from OneDrive
  - Enumerate all subfolders inside the selected parent folder
  - For each subfolder:
    - **Detect Publication Status**: Check if folder name ends with `-Done` (case-insensitive)
      - If ends with `-Done`: `is_done = 1` (published)
      - If no `-Done`: `is_done = 0` (unpublished / active pending)
    - Store `original_folder_name` (name stripped of any trailing `-Done`)
    - Discover files in folder:
      - Markdown: `caption.md`, `linkedin-post.md`, `skool-post.md`, `cover-prompt.md`
      - Video: `*-hyperframes.mp4` (prioritized for Reels & YouTube) and standard `*.mp4`
      - Document: `*.pdf` (used for LinkedIn document carousel)
      - Visuals: `cover.svg` (cover visual / thumbnail)
    - **Discover Slides Subfolder (`slides/`)**:
      - Enumerate files in `slides/` (e.g., `code-moats-slide-1.svg` ... `slide-16.svg`)
      - **Natural Numeric Sort**: Parse slide indices and sort in ascending order (`1, 2, ... 9, 10, 16`)
      - Store slide count and slide metadata
    - Create/update `content_items` record (upsert based on `drive_item_id`)
- [ ] Markdown extraction service
  - Parse `caption.md` → extract title (first `# Heading`) and body (remaining markdown)
  - Parse `linkedin-post.md` → extract title and body
  - Parse `skool-post.md` → extract title and body
  - Parse `cover-prompt.md` → extract image prompt for informational display
  - Use regex/marked for title/body separation
- [ ] Channel post auto-population
  - For each content item, create/update 5 `channel_posts` records (one per channel):
    - **YouTube**: `caption.md` title + body, media_type = 'video' (`*-hyperframes.mp4`)
    - **LinkedIn**: `linkedin-post.md` title + body, media_type = 'pdf' (`*.pdf` native carousel)
    - **Instagram**: `caption.md` body, media_type = 'video_reel' (`*-hyperframes.mp4`) OR 'carousel' (`slides/*.svg`)
    - **Facebook**: `caption.md` body, media_type = 'video_reel' (`*-hyperframes.mp4`) OR 'carousel' (`slides/*.svg`)
    - **Skool**: `skool-post.md` title + body, media_type = null (manual copy-paste)
  - Preserve user edits on re-sync (do not overwrite fields modified by the user)
- [ ] Sync status tracking (last synced timestamp, new/changed items count)
- [ ] Content list API
  - `GET /api/content` → paginated list of content items with channel statuses, filtered by `is_done`
  - `GET /api/content/[id]` → single content item with all channel posts, slide list, and media info

---

### Phase 4: Content Dashboard & Browser
**Estimated effort: 3-4 days**

- [ ] Dashboard page (`/`) — **Analytics-rich, not a simple list**
  - **Prominent Filter Tabs**:
    - **"Unpublished" [Default View]** — Shows only folders without `-Done`, keeping focus on content ready to be published
    - **"Published (-Done)"** — Archive of already published folders
    - **"All Folders"** — Complete view
  - **Summary analytics cards** (clickable, act as quick filters):
    - **Unpublished Folders** (Actionable pending items)
    - **Published (-Done)** (Successfully completed items)
    - **Scheduled** (Queued for future release)
    - **Failed** (Needs maker attention — highlighted in red)
    - **Channel Breakdown** (Total published posts across YouTube, LinkedIn, Instagram, Facebook)
  - **Per-channel progress bars** — visual indicator of publication coverage per platform
  - **Last refreshed datetime** — displayed prominently with relative time ("Just now", "5 minutes ago") and exact timestamp on hover
  - **Quick sync button** — with animated pulse during sync, progress counter, and toast
  - **Recent activity feed** — chronological log of publish events, folder renames, and errors
- [ ] Content browser page (`/content`)
  - **Status filter tabs**: [Unpublished] | [Published (-Done)] | [All]
  - **Grid / List view toggle** with user preference persistence
  - Each content card features:
    - **Folder name & title**
    - **Cover thumbnail**: Crisp preview of `cover.svg` or `slide-1.svg`
    - **Status badge**: `Unpublished` (Amber/Indigo) vs `Published (-Done)` (Emerald Green)
    - **Per-channel indicators**: YouTube 🔴, LinkedIn 🔵, Instagram 🟣, Facebook 🔷, Skool 🟠 (✅ published, 📅 scheduled, ⬜ draft, ❌ failed)
    - **Slide count & video tag**: e.g., "16 Slides • Hyperframes Reel"
    - **Quick actions**:
      - Edit / Configure
      - "Mark as Done & Rename on OneDrive" button
      - Direct link to OneDrive folder
  - **Sorting**:
    - Folder Name / Date (newest first, oldest first)
    - Title (A-Z, Z-A)
    - Publication Status (least completed first)
  - **Filtering**:
    - By publication status (`Unpublished` vs `Published (-Done)`)
    - By individual channel status (e.g., "YouTube draft", "LinkedIn pending")
    - Has failures
  - **Search**: Instant search across titles, folder names, and post body snippets
  - **Bulk actions**: Multi-select → Publish all to selected channels, or Batch Mark as Done
  - **Pagination**: 10, 25, or 50 items per page with smooth transitions
- [ ] Sync controls
  - Manual sync with live folder processing counter
  - Persistent sync status indicator in header navigation

---

### Phase 5: Per-Channel Content Editor
**Estimated effort: 3-4 days**

- [ ] Content detail page (`/content/[id]`)
  - Header: content title, folder name, sync status
  - Tab bar for each channel: YouTube | LinkedIn | Instagram | Facebook | Skool
  - Per-channel editor panel:
    - **Title field** (editable text input)
    - **Body field** (TipTap rich text editor)
    - **Media preview** (video player for .mp4, PDF viewer/carousel for .pdf)
    - **Post type selector** (for Instagram/Facebook: Reel vs Carousel)
    - **Zernio account selector** (dropdown of configured accounts)
    - **Zernio profile selector** (dropdown of profiles for the selected account + platform)
    - **Schedule controls** (publish now vs schedule date/time picker)
    - **Publish button** (per channel)
    - **Status badge** (draft / scheduled / publishing / published / failed)
  - Side-by-side preview showing how the post will appear on each platform
- [ ] Skool channel specifics
  - Read-only "manual" badge
  - Copy-to-clipboard button for title and body
  - No Zernio account or publish button
- [ ] Auto-save on edit (debounced save to DB)
- [ ] Reset to original (re-extract from .md) button

---

### Phase 6: Zernio Account Management
**Estimated effort: 1-2 days**

- [ ] Settings page for Zernio accounts (`/settings/zernio`)
  - Add new account: name + API key input
  - Encrypted storage of API keys in DB
  - List all configured accounts with edit/delete
  - "Test Connection" button per account (calls Zernio API to verify key)
- [ ] Profile discovery
  - `POST /api/zernio/[accountId]/discover` → call Zernio API to list connected profiles
  - Store discovered profiles in `zernio_profiles` table
  - Show per-account: which platforms are connected, profile names/avatars
  - "Refresh Profiles" button
- [ ] Profile assignment
  - On content editor, dropdown shows profiles matching the channel's platform
  - Grouped by Zernio account name

**Zernio API calls:**
```
GET /v1/profiles → list all connected social profiles for an API key
```

---

### Phase 7: Publishing Engine
**Estimated effort: 3-4 days**

- [ ] Media upload service
  1. Download file from OneDrive (via MS Graph API `GET /me/drive/items/{id}/content`)
  2. For vector carousel slides (`slides/*.svg`):
     - Rasterize `.svg` to crisp high-res 1080×1350 / 1080×1080 PNG buffer using `@resvg/resvg-js`
     - Content-Type: `image/png`
  3. For PDFs and videos: upload binary directly with proper MIME type
  4. Request presigned URL from Zernio (`POST /v1/media/presign`)
  5. Upload file binary/buffer to presigned URL (`PUT <uploadUrl>`)
  6. Return `publicUrl` for use in post creation
  - Handle large video streaming and progress updates
  - Cache uploaded media URLs by hash to avoid redundant re-uploads

- [ ] Publish orchestrator per channel:

  **YouTube:**
  ```json
  {
    "platforms": [{ "platform": "youtube", "accountId": "<profileId>" }],
    "content": "<body from caption.md>",
    "title": "<title from caption.md>",
    "mediaUrls": ["<uploaded *-hyperframes.mp4 publicUrl>"],
    "publishNow": true
  }
  ```

  **LinkedIn:**
  ```json
  {
    "platforms": [{ "platform": "linkedin", "accountId": "<profileId>" }],
    "content": "<body from linkedin-post.md>",
    "mediaUrls": ["<uploaded PDF publicUrl>"],
    "publishNow": true
  }
  ```
  > PDF is uploaded directly as a native document carousel.

  **Instagram (Reel):**
  ```json
  {
    "platforms": [{ "platform": "instagram", "accountId": "<profileId>" }],
    "content": "<caption from caption.md>",
    "mediaUrls": ["<uploaded *-hyperframes.mp4 publicUrl>"],
    "postType": "reel",
    "publishNow": true
  }
  ```

  **Instagram (Carousel from slide SVGs):**
  - Read all slide SVGs in natural order (`slide-1` to `slide-16`)
  - Rasterize to PNG buffers & upload to Zernio
  - Create carousel post:
  ```json
  {
    "platforms": [{ "platform": "instagram", "accountId": "<profileId>" }],
    "content": "<caption from caption.md>",
    "mediaUrls": ["<slide1.png>", "<slide2.png>", ...],
    "postType": "carousel",
    "publishNow": true
  }
  ```

  **Facebook (Reel or Carousel):**
  - Reel: Video payload with `postType: "reel"`
  - Carousel: Multi-image payload with rasterized slide URLs

- [ ] **Post-Publish OneDrive Folder Rename Workflow (`-Done` Suffix)**
  - When all selected channels publish successfully (or user clicks "Publish All & Mark Done" / "Mark as Published"):
  1. Call Microsoft Graph API: `PATCH /me/drive/items/{drive_item_id}`
     ```json
     { "name": "<original_folder_name>-Done" }
     ```
  2. Update database record:
     - `folder_name = "<original_folder_name>-Done"`
     - `is_done = 1`
     - `renamed_at = CURRENT_TIMESTAMP`
  3. Emit toast notification: *"Published to channels & renamed folder to `<folder_name>-Done` on OneDrive"*
  4. Content immediately shifts from the **Unpublished** tab to the **Published (-Done)** archive
  - Settings option: `auto_rename_onedrive_on_publish` (default: true)

- [ ] Scheduling support
  - If `scheduledFor` is set, pass ISO timestamp to Zernio API
  - Update `channel_posts.status` to 'scheduled'
  - Note: Folder rename to `-Done` is executed immediately or scheduled once the future publish is verified

- [ ] Error handling & retry
  - Capture Zernio API errors and store in `channel_posts.error_message`
  - Set status to 'failed' with detailed diagnostic message
  - Retry button on failed posts

- [ ] Idempotency
  - Generate `Idempotency-Key` (UUID) per publish attempt to avoid duplicate posts

- [ ] Publish status tracking
  - Real-time status updates via polling or SSE
  - Status flow: `draft` → `publishing` → `published` | `failed`

---

### Phase 8: Polish & Production Readiness
**Estimated effort: 3-4 days**

- [ ] **Professional UI polish** — no AI-slop
  - Consistent spacing, typography, and color system across all pages
  - Custom branded loading states (skeleton screens, not spinners everywhere)
  - Proper empty states with onboarding guidance
  - Subtle micro-animations (page transitions, card hover effects, status changes)
  - Professional iconography (Lucide icons, consistent sizing)
- [ ] **Mobile-first responsive QA**
  - Test and refine all views at 375px, 768px, and 1440px breakpoints
  - Bottom tab navigation on mobile with smooth transitions
  - Touch-friendly controls (44px min tap targets, swipe gestures where appropriate)
  - Responsive data tables (card layout on mobile, table on desktop)
- [ ] Error boundaries and loading states across all pages
- [ ] Toast notifications for publish success/failure
- [ ] Dark mode support (toggle in settings, system preference detection)
- [ ] Activity log (record all publish attempts with timestamps)
- [ ] Bulk publish (select multiple content items → publish all channels at once)
- [ ] Environment variable documentation
- [ ] Docker support for self-hosting
- [ ] README with setup instructions

---

## 9. Environment Variables

```env
# App
ADMIN_PASSWORD=<hashed admin password>
SESSION_SECRET=<random 32-char string>
DATABASE_URL=file:./db/social-publisher.db

# Microsoft Azure AD (OneDrive)
AZURE_CLIENT_ID=<Azure App Registration Client ID>
AZURE_CLIENT_SECRET=<Azure App Registration Client Secret>
AZURE_TENANT_ID=<Azure Tenant ID or 'common'>
AZURE_REDIRECT_URI=http://localhost:3000/auth/microsoft/callback

# Encryption
ENCRYPTION_KEY=<32-byte hex key for encrypting API keys in DB>
```

> Zernio API keys are stored encrypted in the database, not in environment variables (since multiple accounts are supported).

---

## 10. Key Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "@tanstack/react-query": "^5.0.0",
    "drizzle-orm": "^0.30.0",
    "better-sqlite3": "^11.0.0",
    "@azure/msal-node": "^2.0.0",
    "@microsoft/microsoft-graph-client": "^3.0.0",
    "@resvg/resvg-js": "^2.6.0",
    "gray-matter": "^4.0.0",
    "marked": "^12.0.0",
    "@tiptap/react": "^2.0.0",
    "@tiptap/starter-kit": "^2.0.0",
    "date-fns": "^3.0.0",
    "uuid": "^9.0.0",
    "zod": "^3.0.0",
    "bcryptjs": "^2.4.0",
    "jose": "^5.0.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.22.0",
    "tailwindcss": "^4.0.0",
    "@tailwindcss/typography": "^0.5.0"
  }
}
```

---

## 11. API Route Summary

| Method | Route | Description |
|---|---|---|
| `POST` | `/api/auth/login` | Admin login (password check) |
| `POST` | `/api/auth/logout` | Admin logout |
| `GET` | `/api/auth/session` | Check session validity |
| `GET` | `/api/onedrive/auth` | Start Microsoft OAuth flow |
| `GET` | `/api/onedrive/callback` | OAuth callback handler |
| `GET` | `/api/onedrive/status` | OneDrive connection status |
| `GET` | `/api/onedrive/folders` | List OneDrive folders |
| `POST` | `/api/onedrive/select-folder` | Save selected parent folder |
| `POST` | `/api/onedrive/rename` | Rename a folder in OneDrive (`PATCH /me/drive/items/{id}`) |
| `POST` | `/api/sync` | Trigger content sync from OneDrive (detects `-Done` status) |
| `GET` | `/api/content` | List content items (supports `?status=unpublished|published|all`) |
| `GET` | `/api/content/[id]` | Get content item with channel posts & slide list |
| `PATCH` | `/api/content/[id]/channels/[channel]` | Update channel post (edit text, select account) |
| `POST` | `/api/content/[id]/channels/[channel]/publish` | Publish to a specific channel |
| `POST` | `/api/content/[id]/publish-all` | Publish to all configured channels & optionally mark done |
| `POST` | `/api/content/[id]/mark-done` | Rename folder to `-Done` on OneDrive & update `is_done = 1` |
| `POST` | `/api/content/[id]/unmark-done` | Revert `-Done` suffix on OneDrive & set `is_done = 0` |
| `GET` | `/api/zernio/accounts` | List Zernio accounts |
| `POST` | `/api/zernio/accounts` | Add Zernio account |
| `PUT` | `/api/zernio/accounts/[id]` | Update Zernio account |
| `DELETE` | `/api/zernio/accounts/[id]` | Delete Zernio account |
| `POST` | `/api/zernio/accounts/[id]/test` | Test Zernio API key |
| `POST` | `/api/zernio/accounts/[id]/discover` | Discover profiles for account |
| `GET` | `/api/zernio/profiles` | List all discovered profiles |
| `GET` | `/api/settings` | Get app settings |
| `PUT` | `/api/settings` | Update app settings |

---

## 12. UI Wireframe Descriptions

### 12.1 Dashboard (`/`)
```
┌──────────────────────────────────────────────────────────────┐
│  🏠 Dashboard          Last synced: 2 min ago  [🔄 Sync Now]│
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Analytics                                                   │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐     │
│  │  5     │ │  7     │ │  2     │ │  16    │ │  1     │     │
│  │Unpub'd │ │Published│ │Sched.  │ │Slides/Avg│Failed ⚠│     │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘     │
│                                                              │
│  ┌─ Per-Channel Status ──────────────────────────────────┐   │
│  │  YouTube   ██████░░░░  6/12 published                 │   │
│  │  LinkedIn  ████████░░  8/12 published                 │   │
│  │  Instagram ████░░░░░░  4/12 published                 │   │
│  │  Facebook  ████░░░░░░  4/12 published                 │   │
│  │  Skool     ░░░░░░░░░░  0/12 (manual)                  │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                              │
│  Filter: [★ Unpublished (5)]  [Published -Done (7)]  [All]   │
│  Sort:   [▼ Newest First   ]                                 │
│  ┌──────────────────────────────────────────────────────┐    │
│  │ 📁 20261026-0823  [Amber: Unpublished]               │    │
│  │   "10 Tips for Software Architecture Moats"          │    │
│  │   🖼️ 16 Slides  🎬 Hyperframes Video                 │    │
│  │   YT: ⬜  LI: ✅  IG: 📅  FB: ⬜  SK: ⬜            │    │
│  │   [✏️ Edit & Publish]  [🏷️ Mark Done & Rename]       │    │
│  ├──────────────────────────────────────────────────────┤    │
│  │ 📁 20261025-1420-Done  [Green: Published]            │    │
│  │   "How to Build High-Converting Micro-SaaS"          │    │
│  │   🖼️ 12 Slides  🎬 Hyperframes Video                 │    │
│  │   YT: ✅  LI: ✅  IG: ✅  FB: ✅  SK: ✅            │    │
│  │   [👁️ View Published] [Direct OneDrive Link]        │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
│  Recent Activity                                             │
│  • 🏷️ Renamed "20261025-1420" → "20261025-1420-Done" on OneDrive│
│  • ✅ Published "Architecture Moats" to LinkedIn — 5 min ago  │
│  • 📅 Scheduled "Micro-SaaS" on Instagram — 1 hr ago         │
│  • ❌ Failed "Architecture Moats" on YouTube — 2 hrs ago     │
└──────────────────────────────────────────────────────────────┘
```

### 12.2 Content Editor (`/content/[id]`)
```
┌──────────────────────────────────────────────────────────────┐
│ ← Back  20261026-0823 [Unpublished]   [Publish All & Mark Done]│
├──────────────────────────────────────────────────────────────┤
│  [YouTube] [LinkedIn] [Instagram] [Facebook] [Skool]         │
├────────────────────────┬─────────────────────────────────────┤
│  Editor                │  Live Channel Preview & Assets      │
│                        │                                     │
│  Title:                │  ┌─────────────────────────────┐    │
│  ┌──────────────────┐  │  │ YouTube Preview             │    │
│  │ 10 Tips for...   │  │  │                             │    │
│  └──────────────────┘  │  │ 🎬 [Hyperframes Video]      │    │
│                        │  │ Title: 10 Tips for...       │    │
│  Description:          │  │ Desc: Discover why...       │    │
│  ┌──────────────────┐  │  └─────────────────────────────┘    │
│  │ Rich text editor │  │                                     │
│  │ with formatting  │  │  Slide Carousel (16 slides):        │
│  │ toolbar          │  │  [◀] [Slide 1/16] [Slide 2] [▶]    │
│  └──────────────────┘  │                                     │
│                        │  Zernio Account & Profile:          │
│  Post Type:            │  [▼ Main Account — @deven         ] │
│  (●) Reel  ( ) Carousel│                                     │
│                        │  Schedule: [● Publish Now]          │
│  Status: ⬜ Draft      │  [🚀 Publish This Channel]          │
│                        │  [🏷️ Mark Done & Rename Folder]    │
└────────────────────────┴─────────────────────────────────────┘
```

### 12.3 Settings — Zernio Accounts (`/settings/zernio`)
```
┌──────────────────────────────────────────────────────┐
│  ⚙️ Settings > Zernio Accounts      [+ Add Account]  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │ 🔑 Main Account                              │    │
│  │   API Key: ****...abc123                      │    │
│  │   Profiles:                                   │    │
│  │     🔵 LinkedIn: Deven's Page                │    │
│  │     🔴 YouTube: Deven's Channel              │    │
│  │     📸 Instagram: @deven                     │    │
│  │     📘 Facebook: Deven's Page                │    │
│  │   [🔄 Refresh] [✏️ Edit] [🗑️ Delete]         │    │
│  ├──────────────────────────────────────────────┤    │
│  │ 🔑 Client Account                            │    │
│  │   API Key: ****...xyz789                      │    │
│  │   Profiles:                                   │    │
│  │     🔵 LinkedIn: Client's Page               │    │
│  │   [🔄 Refresh] [✏️ Edit] [🗑️ Delete]         │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

### 12.4 Settings — OneDrive (`/settings/onedrive`)
```
┌──────────────────────────────────────────────────────┐
│  ⚙️ Settings > OneDrive Connection                   │
├──────────────────────────────────────────────────────┤
│                                                      │
│  Connection Status: ✅ Connected                     │
│  Account: deven@example.com                          │
│                                                      │
│  Parent Folder: /Content/Social Media Posts           │
│  [📁 Change Folder]  [🔌 Disconnect]                │
│                                                      │
│  Auto-Rename: [✅] Automatically rename OneDrive     │
│                    folder to "-Done" when published  │
│                                                      │
│  ┌──────────────────────────────────────────────┐    │
│  │  📁 Folder Picker (modal)                    │    │
│  │  ├── 📁 Documents                            │    │
│  │  ├── 📁 Content                              │    │
│  │  │   ├── 📁 Social Media Posts  ← selected   │    │
│  │  │   └── 📁 Blog Posts                       │    │
│  │  └── 📁 Projects                             │    │
│  │                              [Select Folder] │    │
│  └──────────────────────────────────────────────┘    │
│                                                      │
│  Last Sync: Oct 26, 2026 at 2:30 PM                 │
│  [🔄 Sync Now]                                      │
└──────────────────────────────────────────────────────┘
```

---

## 13. Security Considerations

1. **API Key Encryption**: All Zernio API keys encrypted at rest using AES-256-GCM with `ENCRYPTION_KEY`
2. **OAuth Token Security**: Microsoft tokens stored encrypted in DB, refreshed automatically
3. **Session Management**: HTTP-only, secure cookies with `jose` JWT
4. **Input Validation**: All API inputs validated with `zod` schemas
5. **CSRF Protection**: Next.js built-in CSRF handling
6. **Rate Limiting**: Respect Zernio API rate limits; implement exponential backoff

---

## 14. Implementation Order (Recommended)

| Order | Phase | Duration | Dependencies |
|---|---|---|---|
| 1 | Phase 1: Project Scaffolding & Core Setup | 1-2 days | None |
| 2 | Phase 2: OneDrive Integration & Rename Service | 2-3 days | Phase 1 |
| 3 | Phase 3: Content Sync & Extraction (with slides & -Done detection) | 2-3 days | Phase 2 |
| 4 | Phase 6: Zernio Account Management | 1-2 days | Phase 1 (can run parallel with Phase 3) |
| 5 | Phase 4: Content Dashboard & Browser (Mobile-First, Analytics, Filters) | 3-4 days | Phase 3 |
| 6 | Phase 5: Per-Channel Content Editor | 3-4 days | Phase 4, Phase 6 |
| 7 | Phase 7: Publishing Engine & Post-Publish Rename | 3-4 days | Phase 5 |
| 8 | Phase 8: Polish & Production Readiness | 3-4 days | Phase 7 |

**Total estimated effort: ~18-22 days**

---

## 15. Open Questions & Architectural Clarifications

1. **Zernio profile listing API**: The exact endpoint for listing profiles per API key (`/v1/profiles` vs `/v1/accounts`) will be verified on first connect during implementation.
2. **Slide Ordering & Format (RESOLVED)**: Slides are discovered in the `slides/` subfolder with names `*-slide-{n}.svg`. They are sorted using natural integer sort (`slide-1` ... `slide-16`). For Instagram and Facebook, which require raster image formats (JPEG/PNG), the server rasterizes the SVG slides to high-res PNG buffers in memory using `@resvg/resvg-js` before uploading to Zernio presigned URLs. No PDF conversion is needed.
3. **Cover Graphic / Thumbnail (RESOLVED)**: `cover.svg` in each folder provides the cover artwork and dashboard card thumbnail.
4. **OneDrive Status Suffix (RESOLVED)**: Folders without `-Done` are unpublished; folders ending with `-Done` are published. The app calls Graph API `PATCH /me/drive/items/{id}` to append `-Done` upon publishing.
5. **Skool API**: Skool is handled via manual copy-paste with dedicated one-click copy buttons in the editor.
6. **Webhook/callback from Zernio**: If Zernio supports webhooks for asynchronous publish confirmation, a webhook receiver can be added; otherwise, polling `GET /v1/posts/{id}` ensures reliable status progression.
