"use client";

import type { Circle, Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

type Point = { lat: number; lng: number };

/**
 * Map with a draggable navy pin and a translucent gold circle for the service
 * radius (V-02). OpenStreetMap tiles; Leaflet is loaded only in the browser.
 */
export function MapPicker({
  point,
  radiusKm,
  showRadius,
  onMove,
}: {
  point: Point;
  radiusKm: number;
  showRadius: boolean;
  onMove: (point: Point) => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const circle = useRef<Circle | null>(null);
  const onMoveRef = useRef(onMove);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !container.current || map.current) return;
      const m = L.map(container.current, { scrollWheelZoom: false }).setView(
        [point.lat, point.lng],
        11,
      );
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(m);
      const icon = L.divIcon({
        className: "",
        html: '<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#0e1a2f;border:3px solid #fff;box-shadow:0 6px 16px rgba(14,26,47,.35)"></div>',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
      });
      const mk = L.marker([point.lat, point.lng], {
        draggable: true,
        icon,
        keyboard: true,
        title: "Business location. Drag to adjust.",
      }).addTo(m);
      mk.on("dragend", () => {
        const p = mk.getLatLng();
        onMoveRef.current({ lat: p.lat, lng: p.lng });
      });
      m.on("click", (e) => {
        mk.setLatLng(e.latlng);
        onMoveRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
      });
      circle.current = L.circle([point.lat, point.lng], {
        radius: radiusKm * 1000,
        color: "#c9995a",
        weight: 2,
        fillColor: "#e3be84",
        fillOpacity: 0.18,
      });
      map.current = m;
      marker.current = mk;
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
    };
    // Created once; later changes are applied by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep pin, circle and view in sync with the props.
  useEffect(() => {
    const m = map.current;
    if (!m || !marker.current || !circle.current) return;
    marker.current.setLatLng([point.lat, point.lng]);
    circle.current.setLatLng([point.lat, point.lng]);
    circle.current.setRadius(radiusKm * 1000);
    if (showRadius) {
      if (!m.hasLayer(circle.current)) circle.current.addTo(m);
      m.fitBounds(circle.current.getBounds(), { padding: [16, 16] });
    } else {
      circle.current.remove();
      m.setView([point.lat, point.lng], 14);
    }
  }, [point.lat, point.lng, radiusKm, showRadius]);

  return (
    <div
      ref={container}
      className="h-64 w-full overflow-hidden rounded-[20px] bg-surface-2"
      role="application"
      aria-label="Map. Drag the pin or tap the map to adjust your business location."
    />
  );
}
