import * as Notifications from "expo-notifications";
import { t } from "./i18n";

// Local "their birthday is tomorrow" reminders, so you have time to prepare
// a gift - separate from the automatic WhatsApp message that goes out on the
// day itself. These are scheduled entirely on-device (no push server needed)
// and repeat every year.
//
// We cancel and re-schedule the whole set whenever the birthday list changes,
// which keeps things simple and always in sync with what's on screen.

const REMINDER_HOUR = 10; // 10:00 the day before

// The day before a given month/day, as JS Date components (month is
// 0-indexed to match the YEARLY trigger). A non-leap reference year keeps
// e.g. March 1st mapping to Feb 28th rather than a phantom Feb 29th.
function dayBeforeComponents(month, day) {
  const d = new Date(2001, month - 1, day, REMINDER_HOUR, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  return { month: d.getMonth(), day: d.getDate() };
}

export async function syncBirthdayReminders(birthdays) {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return;

    await Notifications.cancelAllScheduledNotificationsAsync();

    for (const b of birthdays) {
      const { month, day } = dayBeforeComponents(b.month, b.day);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: t("rem.title"),
          body: t("rem.body", { name: b.name }),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.YEARLY,
          month,
          day,
          hour: REMINDER_HOUR,
          minute: 0,
        },
      });
    }
  } catch {
    // Best-effort: a failure here shouldn't break loading the birthday list.
  }
}
