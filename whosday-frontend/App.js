import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { Feather } from "@expo/vector-icons";
import { AuthProvider, useAuth } from "./src/AuthContext";
import AuthScreen from "./src/screens/AuthScreen";
import LinkWhatsAppScreen from "./src/screens/LinkWhatsAppScreen";
import BirthdaysScreen from "./src/screens/BirthdaysScreen";
import HistoryScreen from "./src/screens/HistoryScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import BrandSplash from "./src/components/BrandSplash";
import { registerForPushNotifications } from "./src/pushNotifications";
import { COLORS } from "./src/theme";

// Keep the native splash up until BrandSplash (a JS view with the same
// look) is ready to take over - avoids a flash of blank white in between.
SplashScreen.preventAutoHideAsync().catch(() => {});

const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.faintText,
        tabBarStyle: { borderTopColor: COLORS.border },
      }}
    >
      <Tab.Screen
        name="Birthdays"
        component={BirthdaysScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Feather name="gift" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Feather name="clock" size={size} color={color} />,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color, size }) => <Feather name="user" size={size} color={color} />,
        }}
      />
    </Tab.Navigator>
  );
}

function Root() {
  const { session, loading } = useAuth();
  const [linked, setLinked] = useState(false);

  // Re-check WhatsApp link status whenever a different account signs in.
  useEffect(() => {
    setLinked(false);
  }, [session?.user?.id]);

  useEffect(() => {
    if (!loading) SplashScreen.hideAsync().catch(() => {});
  }, [loading]);

  // Ask for notification permission once the user has actually finished
  // onboarding, not immediately at launch.
  useEffect(() => {
    if (linked && session?.user?.id) {
      registerForPushNotifications(session.user.id).catch(() => {});
    }
  }, [linked, session?.user?.id]);

  if (loading) return <BrandSplash />;
  if (!session) return <AuthScreen />;
  if (!linked) return <LinkWhatsAppScreen onLinked={() => setLinked(true)} />;
  return <MainTabs />;
}

export default function App() {
  return (
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Root />
      </NavigationContainer>
    </AuthProvider>
  );
}
