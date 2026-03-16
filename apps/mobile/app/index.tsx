import { useTranslation } from "@pluralscape/i18n/react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
  },
});

export default function HomeScreen(): React.JSX.Element {
  const { t } = useTranslation("common");

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("appName")}</Text>
      <StatusBar style="auto" />
    </View>
  );
}
