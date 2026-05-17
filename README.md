# Kaidow Assistant (Office Admin Agent)

AI-powered internal operations platform — **Google Sheets** database, **LINE** primary interface, **OpenAI** agent, **node-cron** automation.

## Features (v0.2)

### Phase 1 — MVP (ready)
- Google Sheets read/write (Users, Finance, Documents, Meetings)
- Cron: finance reminders, document requests, meeting notices, monthly admin summary
- Payment **escalation** (urgent at 3+ days overdue, notify manager at 7+ days)
- LINE AI agent with tools (list/create/update finance, documents, meetings, tasks)
- **ยืนยัน** + Quick Reply before marking paid
- LINE commands: `/help`, `/status`, `/pending`, `/meetings`
- Auto-register user on LINE **follow**
- **ActivityLogs** audit tab
- **Tasks** workflow tab
- Operations **dashboard**: `GET /dashboard`, `GET /api/ops`

### Phase 2 — partial
- Extended user fields (department, manager, active)
- Document workflow statuses (missing → requested → … → completed)
- Income/expense `recordType` on finance rows
- Task tracking statuses (pending, sent, waiting, completed, failed)

### Phase 3 — partial
- Google Calendar event + email invites when scheduling meetings (`GOOGLE_CALENDAR_ID`)
- Receipt OCR, Gmail import, Google Drive, e-sign, AI doc classification, Rich Menu

## Prerequisites

- Node.js 20+
- Google Cloud **Sheets API** + service account (Editor on spreadsheet)
- LINE Messaging API channel
- OpenAI API key

## Google Sheet layout

One spreadsheet, **six tabs**, row 1 = headers.

### Users

| name | lineUserId | email | role | department | manager | active |
|------|------------|-------|------|------------|---------|--------|

- `role`: `admin`, `user`, `manager`, `finance`, `hr`, …
- `manager`: name of another user (for escalation)
- `active`: `yes` / `no`

### Finance

| name | amount | status | dueDate | responsible | lastReminderAt | category | recordType | lastEscalationAt |

- `status`: `paid` | `unpaid`
- `recordType`: `income` | `expense`
- `dueDate`: `YYYY-MM-DD`

### Documents

| name | documentType | status | owner | lastRequestAt | dueDate | assignedTo |

- `status`: `missing` | `requested` | `received` | `reviewed` | `completed` | `rejected`

### Meetings

| title | datetime | participants | notifiedAt | rsvp | notes | endDatetime | calendarEventId |

### ActivityLogs

| timestamp | actor | action | entityType | entityId | details |

### Tasks

| title | status | assignee | dueDate | sourceType | sourceId | createdAt |

- `status`: `pending` | `sent` | `waiting` | `completed` | `failed`

**Backward compatible:** older sheets with fewer columns still work; new columns default empty.

## Environment

Copy `.env.example` → `.env`. Key variables:

| Variable | Description |
|----------|-------------|
| `GOOGLE_SPREADSHEET_ID` | Spreadsheet ID |
| `LINE_CHANNEL_*` | Messaging API |
| `OPENAI_API_KEY` | Agent |
| `ADMIN_LINE_USER_ID` | Monthly summary recipient |
| `FINANCE_ESCALATE_USER_DAYS` | Default `3` |
| `FINANCE_ESCALATE_MANAGER_DAYS` | Default `7` |
| `DASHBOARD_TOKEN` | Optional protect `/dashboard` |
| `GOOGLE_CALENDAR_ID` | Team calendar ID — creates events + email invites on `create_meeting` |
| `GOOGLE_CALENDAR_SUBJECT` | Workspace user to impersonate (recommended for invites) |
| `GOOGLE_CALENDAR_TIMEZONE` | Default `Asia/Bangkok` |

### Google Calendar setup

1. Enable **Google Calendar API** in the same Google Cloud project as Sheets.
2. Set `GOOGLE_CALENDAR_ID` to a calendar shared with the service account (**Make changes to events**), or use `primary` with `GOOGLE_CALENDAR_SUBJECT`.
3. Set `GOOGLE_CALENDAR_SUBJECT` to a Workspace user (e.g. `admin@company.com`) and grant the service account [domain-wide delegation](https://developers.google.com/identity/protocols/oauth2/service-account#delegatingauthority) with scope `https://www.googleapis.com/auth/calendar`.
4. Ensure **Users** rows have **email** filled — invites are sent to those addresses.
5. Re-run `pnpm run setup:sheet` to add Meetings columns `endDatetime`, `calendarEventId`.

## Run

```bash
npm install
cp .env.example .env
npm run dev
```

```bash
npm run build && npm start
npm test
npm run typecheck
```

## HTTP routes

| Route | Description |
|-------|-------------|
| `GET /health` | Health check |
| `GET /dashboard` | Ops HTML dashboard |
| `GET /api/ops` | Ops JSON snapshot |
| `POST /webhook/line` | LINE webhook |

## LINE setup

1. HTTPS public URL → `https://<host>/webhook/line`
2. User adds friend → auto row in **Users** (name `(รอยืนยัน-xxxx)` until admin renames)
3. Chat or use `/help`

## Escalation example

- Unpaid, due passed **3 days** → urgent reminder to responsible
- **7 days** overdue → also push to responsible’s **manager** (from Users.manager)

## Project map

| Area | Path |
|------|------|
| LINE | `src/line/*` |
| Agent | `src/agent/*` |
| Cron | `src/jobs/*` |
| Sheets | `src/sheets/*` |
| Audit | `src/audit/logActivity.ts` |
| Dashboard | `src/dashboard/*` |

## Notes

- Run **one instance** in production (in-memory confirm state).
- Do not commit `.env` or credentials.
