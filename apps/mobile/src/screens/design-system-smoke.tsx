import {
  Avatar,
  Badge,
  Button,
  Icon,
  IconButton,
  Input,
  PluralscapeLogo,
  Switch,
  ThemeProvider,
  useTheme,
  useThemeMode,
  type ThemeMode,
} from "@pluralscape/design-system";
import { type ReactElement, type ReactNode, useCallback, useState } from "react";
import { ScrollView, Text, View } from "react-native";

const LAYOUT = {
  scrollPadding: 24,
  titleFontSize: 20,
  titleMarginBottom: 16,
  sectionMarginBottom: 24,
  sectionLabelFontSize: 12,
  sectionLabelMarginBottom: 8,
  rowGap: 8,
  logoSize: 64,
} as const;

const MODES: readonly ThemeMode[] = [
  "default",
  "static",
  "reduced-motion",
  "high-contrast",
  "littles",
] as const;

const INITIAL_MODE: ThemeMode = "default";

function noop(): void {
  // Empty handler for stateless props (Switch demo, button onPress, etc.).
}

export function DesignSystemSmokeScreen(): ReactElement {
  const [mode, setMode] = useState<ThemeMode>(INITIAL_MODE);
  return (
    <ThemeProvider mode={mode} onModeChange={setMode}>
      <SmokeContent />
    </ThemeProvider>
  );
}

function SmokeContent(): ReactElement {
  const theme = useTheme();
  const { mode, setMode } = useThemeMode();

  // `useCallback` to keep the noop handler reference-stable across renders.
  const handleNoopValueChange = useCallback(noop, []);
  const handleNoopChangeText = useCallback(noop, []);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.color.bg }}
      contentContainerStyle={{ padding: LAYOUT.scrollPadding }}
    >
      <Text
        style={{
          color: theme.color.fg,
          fontFamily: theme.font.sans,
          fontSize: LAYOUT.titleFontSize,
          marginBottom: LAYOUT.titleMarginBottom,
        }}
      >
        {"Design System Smoke"}
      </Text>

      <Section label="Mode">
        <View style={{ flexDirection: "row", gap: LAYOUT.rowGap, flexWrap: "wrap" }}>
          {MODES.map((m) => (
            <Button
              key={m}
              onPress={() => {
                setMode(m);
              }}
              variant={mode === m ? "primary" : "secondary"}
            >
              {m}
            </Button>
          ))}
        </View>
      </Section>

      <Section label="Logo">
        <PluralscapeLogo variant="icon" size={LAYOUT.logoSize} />
      </Section>

      <Section label="Buttons">
        <View style={{ flexDirection: "row", gap: LAYOUT.rowGap, flexWrap: "wrap" }}>
          <Button onPress={noop}>{"Primary"}</Button>
          <Button onPress={noop} variant="secondary">
            {"Secondary"}
          </Button>
          <Button onPress={noop} variant="ghost">
            {"Ghost"}
          </Button>
          <Button onPress={noop} variant="danger">
            {"Danger"}
          </Button>
        </View>
      </Section>

      <Section label="IconButton + Icon">
        <View style={{ flexDirection: "row", gap: LAYOUT.rowGap, alignItems: "center" }}>
          <Icon name="check" />
          <IconButton name="x" accessibilityLabel="Close" onPress={noop} />
          <IconButton
            name="settings"
            accessibilityLabel="Settings"
            onPress={noop}
            tone="muted"
          />
        </View>
      </Section>

      <Section label="Badges">
        <View style={{ flexDirection: "row", gap: LAYOUT.rowGap, flexWrap: "wrap" }}>
          <Badge tone="success">{"Fronting"}</Badge>
          <Badge tone="intimate">{"Intimate"}</Badge>
          <Badge tone="warning">{"Warning"}</Badge>
          <Badge tone="danger">{"Danger"}</Badge>
          <Badge>{"Neutral"}</Badge>
        </View>
      </Section>

      <Section label="Avatars">
        <View style={{ flexDirection: "row", gap: LAYOUT.rowGap }}>
          <Avatar label="Aria" />
          <Avatar label="Theo" size="sm" />
          <Avatar label="Cleo" size="lg" />
          <Avatar label="Wren" shape="circle" />
        </View>
      </Section>

      <Section label="Input">
        <Input
          label="Email"
          value=""
          onChangeText={handleNoopChangeText}
          placeholder="you@plural.app"
        />
      </Section>

      <Section label="Switch">
        <Switch
          value={true}
          onValueChange={handleNoopValueChange}
          accessibilityLabel="Demo toggle"
        />
      </Section>
    </ScrollView>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }): ReactElement {
  const theme = useTheme();
  return (
    <View style={{ marginBottom: LAYOUT.sectionMarginBottom }}>
      <Text
        style={{
          color: theme.color.fgMuted,
          fontFamily: theme.font.sans,
          fontSize: LAYOUT.sectionLabelFontSize,
          marginBottom: LAYOUT.sectionLabelMarginBottom,
        }}
      >
        {label.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}
