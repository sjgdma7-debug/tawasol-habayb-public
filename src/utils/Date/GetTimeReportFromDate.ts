const getTimeReportFromDate = (date: string | null) => {
  if (!date) return null;

  const now = new Date();
  const messageDate = new Date(date);

  if (isNaN(messageDate.getTime())) return null;

  const diffInSeconds = Math.floor((now.getTime() - messageDate.getTime()) / 1000);
  const minute = 60;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;

  if (diffInSeconds < minute) return "الآن";
  if (diffInSeconds < hour) {
    const m = Math.floor(diffInSeconds / minute);
    return `منذ ${m} دقيقة${m === 1 ? "" : "ات"}`;
  }
  if (diffInSeconds < day) {
    const h = Math.floor(diffInSeconds / hour);
    return `منذ ${h} ساعة${h === 1 ? "" : "ات"}`;
  }
  if (diffInSeconds < month) {
    const d = Math.floor(diffInSeconds / day);
    return `منذ ${d} يوم`;
  }
  if (diffInSeconds < year) {
    const mo = Math.floor(diffInSeconds / month);
    return `منذ ${mo} شهر`;
  }
  const y = Math.floor(diffInSeconds / year);
  return `منذ ${y} سنة`;
};

export default getTimeReportFromDate;