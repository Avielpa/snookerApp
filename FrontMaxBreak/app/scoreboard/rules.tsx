import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet,
  LayoutAnimation, UIManager, Platform,
} from 'react-native';
import { DeviceAwareFilterScrollView } from '../../components/DeviceAwareFilterScrollView';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}
import { router } from 'expo-router';
import { scoreboardColors } from '../../constants/scoreboardTheme';
import {
  SNOOKER_RULES, RULE_CATEGORIES, searchRules, SnookerRule,
} from '../../services/snookerRules';

export default function RulesScreen() {
  const c = scoreboardColors;
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const results = useMemo(() => {
    let rules = query.trim() ? searchRules(query) : SNOOKER_RULES;
    if (selectedCategory && !query.trim()) {
      rules = rules.filter(r => r.category === selectedCategory);
    }
    return rules;
  }, [query, selectedCategory]);

  function toggle(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(prev => (prev === id ? null : id));
  }

  function renderRule({ item }: { item: SnookerRule }) {
    const expanded = expandedId === item.id;
    return (
      <TouchableOpacity
        style={[styles.ruleCard, { backgroundColor: c.cardBackground, borderColor: c.cardBorder }]}
        onPress={() => toggle(item.id)}
        activeOpacity={0.8}
      >
        <View style={styles.ruleHeader}>
          <Text style={[styles.ruleCategory, { color: c.textMuted, fontFamily: 'PoppinsRegular' }]}>{item.category}</Text>
          <Text style={[styles.chevron, { color: c.textMuted, fontFamily: 'PoppinsRegular' }]}>{expanded ? '▲' : '▼'}</Text>
        </View>
        <Text style={[styles.ruleQ, { color: c.textPrimary }]}>{item.question}</Text>
        {expanded && (
          <Text style={[styles.ruleA, { color: c.textSecondary }]}>{item.answer}</Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: c.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: c.cardBorder }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={{ color: c.textMuted, fontSize: 28, lineHeight: 32 }}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: c.textHeader }]}>Rules of Snooker</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search */}
      <View style={[styles.searchBox, { backgroundColor: c.backgroundSecondary, borderColor: c.cardBorder }]}>
        <Text style={{ color: c.textMuted, fontSize: 16, marginRight: 6 }}>🔍</Text>
        <TextInput
          style={[styles.searchInput, { color: c.textPrimary }]}
          placeholder="Search rules..."
          placeholderTextColor={c.textMuted}
          value={query}
          onChangeText={t => { setQuery(t); setSelectedCategory(null); }}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Text style={{ color: c.textMuted }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Category chips */}
      {!query.trim() && (
        <DeviceAwareFilterScrollView
          options={[
            { id: 'all', label: 'All' },
            ...RULE_CATEGORIES.map(cat => ({ id: cat, label: cat })),
          ]}
          selectedValue={selectedCategory ?? 'all'}
          onSelectionChange={val => setSelectedCategory(val === 'all' ? null : val)}
          colors={c}
        />
      )}

      {/* Rules list */}
      <FlatList
        style={{ flex: 1 }}
        data={results}
        keyExtractor={r => r.id}
        renderItem={renderRule}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: c.textMuted }]}>No rules match your search.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backBtn: { padding: 6 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 18,
    fontFamily: 'PoppinsBold',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
  },
  ruleCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  ruleCategory: { fontSize: 10, letterSpacing: 0.5 },
  chevron: { fontSize: 10 },
  ruleQ: {
    fontSize: 14,
    fontFamily: 'PoppinsBold',
    lineHeight: 20,
  },
  ruleA: {
    fontSize: 13,
    fontFamily: 'PoppinsRegular',
    lineHeight: 20,
    marginTop: 8,
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
    fontFamily: 'PoppinsRegular',
  },
});
