import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Requests permission, grabs this device's Expo push token, and stores it
// on the signed-in user's profile row so the backend can notify them when
// a birthday message actually goes out. Expo Go can't receive remote push
// since SDK 53 - this only works in a real dev/production build.
export async function registerForPushNotifications(userId) {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let status = existing;
  if (status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== "granted") return null;

  const { data: token } = await Notifications.getExpoPushTokenAsync();
  if (token) {
    await supabase.from("profiles").update({ push_token: token }).eq("id", userId);
  }
  return token;
}
