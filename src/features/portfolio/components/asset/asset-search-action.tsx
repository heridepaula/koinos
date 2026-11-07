"use client";

import { SearchIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTabBarAction } from "@/shared/components/tab-bar-action";

/** No iPhone, a busca vai no botão redondo ao lado da tab bar, como a lupa dos apps do iOS 26. */
export function AssetSearchAction() {
  const router = useRouter();
  useTabBarAction({
    label: "Buscar ativo",
    icon: SearchIcon,
    onPress: () => router.push("/ativos"),
  });
  return null;
}
