import { config } from "./config.js";
import { registerCronJobs } from "./jobs/index.js";
import { isGoogleCalendarConfigured } from "./google/calendarClient.js";
import { startServer } from "./server.js";

console.log("Kaidow Assistant starting", {
  port: config.PORT,
  model: config.OPENAI_MODEL,
  calendar: isGoogleCalendarConfigured()
    ? config.GOOGLE_CALENDAR_ID
    : "disabled",
});

registerCronJobs();
startServer();
