"use client";

import { createContext, useContext, useEffect, useState } from "react";

type WidgetPageContextValue = {
  widgetPageInfo: string;
  setWidgetPageInfo: (info: string) => void;
};

const fallbackContext: WidgetPageContextValue = {
  widgetPageInfo: "",
  setWidgetPageInfo: () => {},
};

const WidgetPageContext = createContext<WidgetPageContextValue | null>(null);

export function WidgetPageContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const parentContext = useContext(WidgetPageContext);
  const [widgetPageInfo, setWidgetPageInfo] = useState("");
  // ネストを防ぐ: 既に上位に Provider がある場合はラップしない
  if (parentContext) return <>{children}</>;
  return (
    <WidgetPageContext.Provider value={{ widgetPageInfo, setWidgetPageInfo }}>
      {children}
    </WidgetPageContext.Provider>
  );
}

export function useWidgetPageContext() {
  return useContext(WidgetPageContext) ?? fallbackContext;
}

/** ページコンポーネントからウィジェットにコンテキスト情報を注入する */
export function useSetWidgetPageInfo(info: string) {
  const { setWidgetPageInfo } = useWidgetPageContext();
  useEffect(() => {
    setWidgetPageInfo(info);
    return () => setWidgetPageInfo("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info]);
}
