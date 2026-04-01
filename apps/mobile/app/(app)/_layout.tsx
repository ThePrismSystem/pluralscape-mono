import { Redirect, Slot } from "expo-router";
import React from "react";


import { useAuth } from "../../src/auth/index.js";

export default function AppLayout(): React.JSX.Element {
  const { state } = useAuth();

  if (state === "unauthenticated") {
    return <Redirect href="/(auth)/login" />;
  }

  return <Slot />;
}
