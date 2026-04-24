const getTimeFromDate = (date: string | null) => {
  if (!date) return null;

  const dateObj = new Date(date);
  if (isNaN(dateObj.getTime())) return null;

  const hours = dateObj.getHours();
  const minutes = String(dateObj.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "م" : "ص";
  const hour12 = hours % 12 || 12;

  return `${hour12}:${minutes} ${ampm}`;
};

export default getTimeFromDate;