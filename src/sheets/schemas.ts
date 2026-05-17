/** Tab names — first row = headers */
export const TABS = {
  users: "Users",
  finance: "Finance",
  documents: "Documents",
  meetings: "Meetings",
  activityLogs: "ActivityLogs",
  tasks: "Tasks",
} as const;

/** Column order per tab (0-based index after header row) */
export const COLS = {
  users: [
    "name",
    "lineUserId",
    "email",
    "role",
    "department",
    "manager",
    "active",
  ] as const,
  finance: [
    "name",
    "amount",
    "status",
    "dueDate",
    "responsible",
    "lastReminderAt",
    "category",
    "recordType",
    "lastEscalationAt",
  ] as const,
  documents: [
    "name",
    "documentType",
    "status",
    "owner",
    "lastRequestAt",
    "dueDate",
    "assignedTo",
  ] as const,
  meetings: [
    "title",
    "datetime",
    "participants",
    "notifiedAt",
    "rsvp",
    "notes",
    "endDatetime",
    "calendarEventId",
  ] as const,
  activityLogs: [
    "timestamp",
    "actor",
    "action",
    "entityType",
    "entityId",
    "details",
  ] as const,
  tasks: [
    "title",
    "status",
    "assignee",
    "dueDate",
    "sourceType",
    "sourceId",
    "createdAt",
  ] as const,
} as const;

export const DOCUMENT_STATUSES = [
  "missing",
  "requested",
  "received",
  "reviewed",
  "completed",
  "rejected",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const TASK_STATUSES = [
  "pending",
  "sent",
  "waiting",
  "completed",
  "failed",
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export type UserRow = {
  rowIndex: number;
  name: string;
  lineUserId: string;
  email: string;
  role: string;
  department: string;
  manager: string;
  active: boolean;
};

export type FinanceRow = {
  rowIndex: number;
  name: string;
  amount: string;
  status: string;
  dueDate: string;
  responsible: string;
  lastReminderAt: string;
  category: string;
  recordType: string;
  lastEscalationAt: string;
};

export type DocumentRow = {
  rowIndex: number;
  name: string;
  documentType: string;
  status: string;
  owner: string;
  lastRequestAt: string;
  dueDate: string;
  assignedTo: string;
};

export type MeetingRow = {
  rowIndex: number;
  title: string;
  datetime: string;
  participants: string;
  notifiedAt: string;
  rsvp: string;
  notes: string;
  endDatetime: string;
  calendarEventId: string;
};

export type ActivityLogRow = {
  rowIndex: number;
  timestamp: string;
  actor: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
};

export type TaskRow = {
  rowIndex: number;
  title: string;
  status: string;
  assignee: string;
  dueDate: string;
  sourceType: string;
  sourceId: string;
  createdAt: string;
};

export function colLetterFor<T extends readonly string[]>(
  cols: T,
  field: T[number],
): string {
  const idx = cols.indexOf(field);
  return String.fromCharCode("A".charCodeAt(0) + idx);
}
