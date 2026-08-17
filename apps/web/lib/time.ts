export function formatRelativeTime(date: Date, locale: string): string {
  const diff = Math.max(0, Date.now() - date.getTime());
  const seconds = Math.floor(diff / 1000);

  if (seconds < 60) {
    return locale.startsWith("zh") ? "刚刚" : "just now";
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      -minutes,
      "minute"
    );
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      -hours,
      "hour"
    );
  }

  const days = Math.floor(hours / 24);
  if (days < 30) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      -days,
      "day"
    );
  }

  const months = Math.floor(days / 30);
  if (months < 12) {
    return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
      -months,
      "month"
    );
  }

  const years = Math.floor(months / 12);
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(
    -years,
    "year"
  );
}
