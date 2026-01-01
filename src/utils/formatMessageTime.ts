import { format, isToday, isYesterday } from "date-fns";
import { zhCN } from "date-fns/locale";

export function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  
  const timeStr = format(date, "HH:mm", { locale: zhCN });
  
  if (isToday(date)) {
    // Today: show only time
    return timeStr;
  } else if (isYesterday(date)) {
    // Yesterday: show "昨天" + time
    return `昨天 ${timeStr}`;
  } else {
    // 2+ days ago: show date + time
    return format(date, "M月d日 HH:mm", { locale: zhCN });
  }
}
