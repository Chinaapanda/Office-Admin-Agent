export type ParsedLineMentions = {
  lineUserIds: string[];
  mentionAll: boolean;
};

export function parseLineMentions(message: {
  mention?: {
    mentionees?: Array<{ type?: string; userId?: string }>;
  };
}): ParsedLineMentions {
  const mentionees = message.mention?.mentionees ?? [];
  const lineUserIds: string[] = [];
  let mentionAll = false;
  for (const m of mentionees) {
    if (m.type === "all") mentionAll = true;
    else if (m.type === "user" && m.userId) lineUserIds.push(m.userId);
  }
  return {
    lineUserIds: [...new Set(lineUserIds)],
    mentionAll,
  };
}
