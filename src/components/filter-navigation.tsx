"use client";
import { createContext, useContext } from "react";

export const FilterNavigationContext = createContext<{
  pending: boolean;
  navigate: (href: string, optimisticUpdate: () => void) => void;
} | null>(null);
export function useFilterNavigation() {
  const navigation = useContext(FilterNavigationContext);
  if (!navigation) throw new Error("Filter pills require the search navigation provider");
  return navigation;
}
