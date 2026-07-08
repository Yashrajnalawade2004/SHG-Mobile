import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/contexts/AuthContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { DataProvider } from "@/contexts/DataContext";
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Back" }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="(super-admin)" options={{ headerShown: false }} />
      <Stack.Screen name="(auth)" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="(main)" options={{ headerShown: false }} />
      <Stack.Screen name="create-meeting" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="meeting/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="members" options={{ headerShown: false }} />
      <Stack.Screen name="member/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="loans" options={{ headerShown: false }} />
      <Stack.Screen name="create-loan" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="loan/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="loan-settings" options={{ headerShown: false }} />
      <Stack.Screen name="rules" options={{ headerShown: false }} />
      <Stack.Screen name="history" options={{ headerShown: false }} />
      <Stack.Screen name="shg-settings" options={{ headerShown: false }} />
      <Stack.Screen name="reports" options={{ headerShown: false }} />
      <Stack.Screen name="bank-loans" options={{ headerShown: false }} />
      <Stack.Screen name="create-bank-loan" options={{ headerShown: false, presentation: "modal" }} />
      <Stack.Screen name="bank-loan/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="bank-loan/allocation/[id]" options={{ headerShown: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <GestureHandlerRootView>
          <KeyboardProvider>
            <LanguageProvider>
              <AuthProvider>
                <DataProvider>
                  <RootLayoutNav />
                </DataProvider>
              </AuthProvider>
            </LanguageProvider>
          </KeyboardProvider>
        </GestureHandlerRootView>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
