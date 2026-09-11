/** Round up so the countdown does not reach zero before the opening instant. */
export function countdownParts(opensAt: string, now: number) {
  const target = Date.parse(opensAt);
  if (!Number.isFinite(target) || !Number.isFinite(now)) return null;
  const seconds = Math.max(0, Math.ceil((target - now) / 1000));
  return {
    days: Math.floor(seconds / 86400),
    hours: Math.floor((seconds % 86400) / 3600),
    minutes: Math.floor((seconds % 3600) / 60),
    seconds: seconds % 60,
  };
}
