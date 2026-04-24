export const formatDateByDistance = (date: Date | string | number): string => {
  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return "";

  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);

  const hours = dateObj.getHours();
  const minutes = String(dateObj.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "م" : "ص";
  const hour12 = hours % 12 || 12;
  const time = `${hour12}:${minutes} ${ampm}`;

  // اليوم
  if (
    dateObj.getDate() === now.getDate() &&
    dateObj.getMonth() === now.getMonth() &&
    dateObj.getFullYear() === now.getFullYear()
  ) {
    return `الساعة ${time}`;
  }

  // أمس
  if (
    dateObj.getDate() === yesterday.getDate() &&
    dateObj.getMonth() === yesterday.getMonth() &&
    dateObj.getFullYear() === yesterday.getFullYear()
  ) {
    return `أمس الساعة ${time}`;
  }

  // أقدم
  const months = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
  ];
  const month = months[dateObj.getMonth()];
  const day = dateObj.getDate();

  return `${day} ${month} الساعة ${time}`;
};