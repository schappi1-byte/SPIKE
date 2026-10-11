"use client";

import { useEffect, useState } from "react";

const KEY = "spike-coach-passcode";

export function useCoachPasscode() {
  const [passcode, setPasscode] = useState("");

  useEffect(() => {
    setPasscode(window.localStorage.getItem(KEY) ?? "");
  }, []);

  const update = (value: string) => {
    setPasscode(value);
    window.localStorage.setItem(KEY, value);
  };

  return [passcode, update] as const;
}
