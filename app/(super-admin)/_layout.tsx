import { Stack } from "expo-router";
import Colors from "@/constants/colors";

export default function SuperAdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: Colors.light.primary,
        },
        headerTintColor: "#fff",
        headerTitleStyle: {
          fontWeight: "bold",
        },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="index"
        options={{
          title: "Super Admin Dashboard",
          headerLeft: () => null,
        }}
      />
    </Stack>
  );
}
