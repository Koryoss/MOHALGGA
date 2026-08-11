import { Gaegu_400Regular, Gaegu_700Bold, useFonts } from "@expo-google-fonts/gaegu";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, TextInput } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

type DefaultFontComponent = typeof Text & {
  defaultProps?: { style?: unknown };
};

let handwrittenDefaultsApplied = false;

function setHandwrittenDefaults() {
  if (handwrittenDefaultsApplied) return;
  const text = Text as DefaultFontComponent;
  const textInput = TextInput as DefaultFontComponent;

  [text, textInput].forEach((component) => {
    const existingStyle = component.defaultProps?.style;
    component.defaultProps = {
      ...component.defaultProps,
      style: [{ fontFamily: "Gaegu_400Regular" }, existingStyle],
    };
  });
  handwrittenDefaultsApplied = true;
}

/** The MVP deliberately has no provider, server, or authentication bootstrap. */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Gaegu_400Regular,
    Gaegu_700Bold,
  });

  if (!fontsLoaded && !fontError) return null;
  setHandwrittenDefaults();

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}
