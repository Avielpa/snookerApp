// components/modern/SearchBox.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useColors } from '../../../contexts/ThemeContext';

interface SearchBoxProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  onSearch?: (text: string) => void;
  onClear?: () => void;
  autoFocus?: boolean;
  editable?: boolean;
}

/**
 * Modern search box component with smooth animations
 * Features haptic feedback and elegant transitions
 */
export const SearchBox: React.FC<SearchBoxProps> = ({
  placeholder = 'Search...',
  value = '',
  onChangeText,
  onSearch,
  onClear,
  autoFocus = false,
  editable = true,
}) => {
  const colors = useColors();
  const [isFocused, setIsFocused] = useState(false);
  const [searchText, setSearchText] = useState(value);
  const focusAnim = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    setSearchText(value);
  }, [value]);

  useEffect(() => {
    Animated.timing(focusAnim, {
      toValue: isFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isFocused, focusAnim]);

  const handleFocus = () => {
    setIsFocused(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleChangeText = (text: string) => {
    setSearchText(text);
    onChangeText?.(text);
  };

  const handleSearch = () => {
    onSearch?.(searchText);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleClear = () => {
    setSearchText('');
    onChangeText?.('');
    onClear?.();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const borderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['rgba(255, 255, 255, 0.14)', 'rgba(255, 167, 38, 0.75)'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        { borderColor },
      ]}
    >
      {/* Search Icon */}
      <TouchableOpacity 
        style={styles.searchIcon} 
        onPress={handleSearch}
        disabled={!editable}
      >
        <Ionicons 
          name="search" 
          size={20} 
          color={isFocused ? '#FFA726' : '#9CA3AF'} 
        />
      </TouchableOpacity>

      {/* Text Input */}
      <TextInput
        style={[styles.input, { color: colors.textPrimary }]}
        placeholder={placeholder}
        placeholderTextColor={colors.textSecondary}
        value={searchText}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onSubmitEditing={handleSearch}
        autoFocus={autoFocus}
        editable={editable}
        returnKeyType="search"
        selectionColor="#FFA726"
      />

      {/* Clear Button */}
      {searchText.length > 0 && (
        <TouchableOpacity 
          style={styles.clearButton} 
          onPress={handleClear}
          disabled={!editable}
        >
          <Ionicons 
            name="close-circle" 
            size={20} 
            color="#9CA3AF" 
          />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

// Add displayName for debugging
SearchBox.displayName = 'SearchBox';

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginVertical: 8,
    backgroundColor: '#1A1A1A',
  },
  searchIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 17,
    fontFamily: 'PoppinsRegular',
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  clearButton: {
    marginLeft: 8,
    padding: 4,
  },
});