import React, { useEffect, useState } from "react";
import { Platform, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AuthProvider, useAuth } from "./src/AuthContext";
import AuthScreen from "./src/screens/AuthScreen";
import LinkWhatsAppScreen from "./src/screens/LinkWhatsAppScreen";
import BirthdaysScreen from "./src/screens/BirthdaysScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import BrandSplash from "./src/components/BrandSplash";
import { registerForPushNotifications } from "./src/pushNotifications";
import { api } from "./src/api";
import { ThemeProvider, useTheme } from "./src/theme";
import { I18nProvider, useI18n } from "./src/i18n";

// Keep the native splash up until BrandSplash (a JS view with the same
// look) is ready to take over - avoids a flash of blank white in between.
SplashScreen.preventAutoHideAsync().catch(() => {});

const Tab = createBottomTabNavigator();

function MainTabs() {
  const { t } = useI18n();
  const COLORS = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.faintText,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "700", marginTop: 2 },
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: COLORS.border,
          paddingTop: 8,
          height: Platform.OS === "ios" ? 88 : 68,
          shadowColor: "#1B1D3A",
          shadowOpacity: 0.06,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
          elevation: 12,
        },
        tabBarItemStyle: { paddingTop: 2 },
      }}
    >
      <Tab.Screen
        name="Birthdays"
        component={BirthdaysScreen}
        options={{
          tabBarLabel: t("tabs.birthdays"),
          tabBarIcon: ({ color, size }) => <Feather name="gift" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarLabel: t("tabs.history"),
          tabBarIcon: ({ color, size }) => <Feather name="clock" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: t("tabs.profile"),
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

function Root() {
  const { session, loading } = useAuth();
  const COLORS = useTheme();
  const userId = session?.user?.id;
  const [linked, setLinked] = useState(false);
  const [checkingLink, setCheckingLink] = useState(true);

  // First-launch intro, shown once on this device (independent of account).
  const [onboardingDone, setOnboardingDone] = useState(null); // null = loading
  useEffect(() => {
    AsyncStorage.getItem("onboardingDone")
      .then((value) => setOnboardingDone(value === "1"))
      .catch(() => setOnboardingDone(true));
  }, []);

  async function finishOnboarding() {
    await AsyncStorage.setItem("onboardingDone", "1").catch(() => {});
    setOnboardingDone(true);
  }

  // Remember, per account, that WhatsApp was already linked - so returning
  // users go straight to the app instead of being sent back through the
  // linking screen on every launch. They can always relink from Profile.
  useEffect(() => {
    let active = true;
    if (!userId) {
      setLinked(false);
      setCheckingLink(false);
      return;
    }
    setCheckingLink(true);
    AsyncStorage.getItem(`whatsappLinked:${userId}`)
      .then((value) => {
        if (active) setLinked(value === "1");
      })
      .finally(() => {
        if (active) setCheckingLink(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  async function markLinked() {
    if (userId) await AsyncStorage.setItem(`whatsappLinked:${userId}`, "1").catch(() => {});
    setLinked(true);
  }

  useEffect(() => {
    if (!loading && onboardingDone !== null) SplashScreen.hideAsync().catch(() => {});
  }, [loading, onboardingDone]);

  // Ask for notification permission once the user has actually finished
  // onboarding, not immediately at launch.
  useEffect(() => {
    if (linked && userId) {
      registerForPushNotifications(userId).catch(() => {});
      // Keep the user's timezone up to date so scheduled sends fire at their
      // real local time (best-effort, silent).
      api.syncTimezone();
    }
  }, [linked, userId]);

  // The main tabs sit under an indigo hero header, so the status bar text
  // should be light there; the white auth/splash/link screens want dark.
  const onHero = !loading && onboardingDone === true && !!session && !checkingLink && linked;

  let content;
  if (loading || onboardingDone === null) content = <BrandSplash />;
  else if (!onboardingDone) content = <OnboardingScreen onDone={finishOnboarding} />;
  else if (!session) content = <AuthScreen />;
  else if (checkingLink) content = <BrandSplash />;
  else if (!linked) content = <LinkWhatsAppScreen onLinked={markLinked} />;
  else content = <MainTabs />;

  return (
    <>
      <StatusBar style={onHero || COLORS.isDark ? "light" : "dark"} />
      {content}
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <I18nProvider>
        <AuthProvider>
          <NavigationContainer>
            <Root />
          </NavigationContainer>
        </AuthProvider>
      </I18nProvider>
    </ThemeProvider>
  );
}
