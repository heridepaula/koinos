"use client";

import { useReportWebVitals } from "next/web-vitals";

// Web Vitals de quem usa o app (LCP, INP, CLS, FCP, TTFB) para o APM. O servidor grava cada
// medida como span (/api/vitals), então a chave da New Relic nunca chega ao navegador. As medidas
// vão em lote quando a aba sai de vista, numa só requisição.

type VitalSample = {
  name: string;
  value: number;
  rating: string;
  navigationType?: string;
  path: string;
};

const ENDPOINT = "/api/vitals";
const MAX_QUEUE = 10;
const queue: VitalSample[] = [];

function flush() {
  if (queue.length === 0) return;
  const body = JSON.stringify(queue.splice(0));
  const queued = navigator.sendBeacon?.(ENDPOINT, new Blob([body], { type: "application/json" }));
  if (!queued) {
    void fetch(ENDPOINT, {
      method: "POST",
      body,
      keepalive: true,
      headers: { "content-type": "application/json" },
    }).catch(() => {});
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
  window.addEventListener("pagehide", flush);
}

/** Só o caminho: a query pode trazer valores da carteira (?valor=). */
function pathOf(url: unknown): string {
  try {
    return new URL(typeof url === "string" ? url : location.href, location.href).pathname;
  } catch {
    return location.pathname;
  }
}

// Fora do componente: a referência estável evita medidas repetidas (doc do useReportWebVitals).
function report(metric: {
  name: string;
  value: number;
  rating: string;
  navigationType?: string;
  navigationURL?: string;
}) {
  queue.push({
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    navigationType: metric.navigationType,
    // Na navegação sem recarregar, a medida pode chegar depois de a URL mudar de novo.
    path: pathOf(metric.navigationURL),
  });
  if (queue.length >= MAX_QUEUE) flush();
}

export function WebVitals() {
  useReportWebVitals(report);
  return null;
}
