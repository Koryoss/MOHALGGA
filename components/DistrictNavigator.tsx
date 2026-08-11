import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { nearbyDistricts } from "@/data/districts";

export function DistrictNavigator({ district, onSelect }: { district: string; onSelect: (name: string) => void }) {
  const neighbors = nearbyDistricts[district] ?? [];
  const names = [...neighbors.slice(0, 2), district, ...neighbors.slice(2, 4)];
  return <View style={styles.wrap} accessibilityLiveRegion="polite"><Text style={styles.caption}>여기서 이어서 놀아볼까?</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
    {names.map((name) => <TouchableOpacity key={name} style={[styles.item, name === district && styles.selected]} onPress={() => onSelect(name)} accessibilityLabel={`${name} 선택`}><Text style={[styles.name, name === district && styles.selectedName]}>{name}</Text></TouchableOpacity>)}
  </ScrollView></View>;
}
const styles = StyleSheet.create({ wrap: { borderTopWidth: 2, borderBottomWidth: 2, borderStyle: "dashed", borderColor: "#20201e", paddingVertical: 12, backgroundColor: "#fffbed" }, caption: { textAlign: "center", color: "#f05278", fontSize: 17, fontWeight: "700", marginBottom: 6 }, row: { alignItems: "center", paddingHorizontal: 12, gap: 10 }, item: { minWidth: 62, height: 48, justifyContent: "center", alignItems: "center", paddingHorizontal: 6 }, selected: { borderWidth: 2.5, borderColor: "#20201e", borderRadius: 28, backgroundColor: "#ffd54a", transform: [{ rotate: "-4deg" }] }, name: { fontSize: 15, color: "#20201e", fontWeight: "600" }, selectedName: { fontSize: 17, fontWeight: "900" } });
