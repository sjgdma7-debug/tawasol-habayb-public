const formatDate = (inputDate: string) => {
  if (!inputDate) return "";

  const dateObj = new Date(inputDate);
  if (isNaN(dateObj.getTime())) return "";

  const now = new Date();

  const daysOfWeek = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const months = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
  ];

  // إذا كان اليوم نفسه
  if (dateObj.toDateString() === now.toDateString()) {
    const hours = dateObj.getHours();
    const minutes = String(dateObj.getMinutes()).padStart(2, "0");
    const ampm = hours >= 12 ? "م" : "ص";
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes} ${ampm}`;
  }

  // إذا خلال آخر 7 أيام
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 7);
  if (dateObj >= sevenDaysAgo && dateObj < now) {
    return daysOfWeek[dateObj.getDay()];
  }

  // إذا نفس السنة
  if (dateObj.getFullYear() === now.getFullYear()) {
    return `${dateObj.getDate()} ${months[dateObj.getMonth()]}`;
  }

  // إذا سنة مختلفة
  return `${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()}`;
};

export default formatDate;