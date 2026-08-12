import geojson from "@/data/seoul-districts.json";
import { memo, useMemo } from "react";
import Svg, { Path, Text } from "react-native-svg";
import { featuredDistricts } from "@/data/courses";

type Position = [number, number];
type Feature = { properties: { name: string }; geometry: { type: "Polygon" | "MultiPolygon"; coordinates: Position[][] | Position[][][] } };

const features = (geojson as { features: Feature[] }).features;
const bounds = features.flatMap((feature) => {
  const polygons = feature.geometry.type === "Polygon" ? feature.geometry.coordinates as Position[][] : feature.geometry.coordinates.flat() as Position[][];
  return polygons.flat();
}).reduce((result, [x, y]) => ({ minX: Math.min(result.minX, x), maxX: Math.max(result.maxX, x), minY: Math.min(result.minY, y), maxY: Math.max(result.maxY, y) }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

const WIDTH = 500;
const HEIGHT = 430;
const pad = 12;
const scale = Math.min((WIDTH - pad * 2) / (bounds.maxX - bounds.minX), (HEIGHT - pad * 2) / (bounds.maxY - bounds.minY));
const point = ([x, y]: Position): [number, number] => [pad + (x - bounds.minX) * scale, HEIGHT - pad - (y - bounds.minY) * scale];
const pathForRing = (ring: Position[]) => ring.map((coordinate, index) => `${index ? "L" : "M"}${point(coordinate).join(" ")}`).join(" ") + " Z";
const pathFor = (feature: Feature) => {
  const polygons = feature.geometry.type === "Polygon" ? [feature.geometry.coordinates as Position[][]] : feature.geometry.coordinates as Position[][][];
  return polygons.map((polygon) => polygon.map(pathForRing).join(" ")).join(" ");
};
const labelPosition = (feature: Feature): [number, number] => {
  const firstRing = feature.geometry.type === "Polygon" ? feature.geometry.coordinates[0] as Position[] : feature.geometry.coordinates[0][0] as Position[];
  const [sumX, sumY] = firstRing.reduce(([x, y], current) => [x + current[0], y + current[1]], [0, 0]);
  return point([sumX / firstRing.length, sumY / firstRing.length]);
};

type Props = { selected: string | null; onSelect: (district: string) => void };

/**
 * Boundary source: Seoul open administrative-district GIS data (JUSO/Seoul),
 * distributed in southkorea/seoul-maps under Apache-2.0. The bundled GeoJSON is
 * its 2013 KOSTAT municipality simplification (5%); see README for attribution.
 */
export const SeoulMap = memo(function SeoulMap({ selected, onSelect }: Props) {
  const items = useMemo(() => features.map((feature) => ({ feature, d: pathFor(feature), label: labelPosition(feature) })), []);
  return <Svg width="100%" height="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} accessibilityLabel="서울 25개 자치구 지도">
    {items.map(({ feature, d, label }) => {
      const name = feature.properties.name;
      const active = name === selected;
      const featured = featuredDistricts.has(name);
      return <Path key={name} d={d} fill={active ? "#ffd54a" : featured ? "#f3c1d9" : "#fffbed"} stroke="#20201e" strokeWidth={1.5} strokeLinejoin="round" onPress={() => onSelect(name)} accessible accessibilityRole="button" accessibilityLabel={`${name} 선택`} />;
    })}
    {items.map(({ feature, label }) => <Text key={`${feature.properties.name}-label`} x={label[0]} y={label[1] + 3} fontSize={11} fontWeight="700" textAnchor="middle" fill="#20201e" pointerEvents="none">{feature.properties.name}</Text>)}
  </Svg>;
});
