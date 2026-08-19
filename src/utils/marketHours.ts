/** IST market window used for paper orders. */
export function getIstClock() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
  const mins = Number(get("hour") || "0") * 60 + Number(get("minute") || "0");
  return { mins, weekday: get("weekday") };
}

export function isWithinMarketHoursIST() {
  const { mins, weekday } = getIstClock();
  const isWeekend = weekday === "Sat" || weekday === "Sun";
  if (isWeekend) return false;
  return mins >= 9 * 60 + 15 && mins <= 15 * 60 + 30;
}

