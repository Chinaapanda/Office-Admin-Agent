type PendingFinancePaid = {
  kind: "finance_paid";
  rowIndex: number;
  summary: string;
  expiresAt: number;
};

const store = new Map<string, PendingFinancePaid>();
const TTL_MS = 10 * 60 * 1000;

export function setPendingFinancePaid(
  lineUserId: string,
  rowIndex: number,
  summary: string,
): void {
  store.set(lineUserId, {
    kind: "finance_paid",
    rowIndex,
    summary,
    expiresAt: Date.now() + TTL_MS,
  });
}

export function getPending(lineUserId: string): PendingFinancePaid | undefined {
  const p = store.get(lineUserId);
  if (!p) return undefined;
  if (Date.now() > p.expiresAt) {
    store.delete(lineUserId);
    return undefined;
  }
  return p;
}

export function clearPending(lineUserId: string): void {
  store.delete(lineUserId);
}
