// app/home/components/StatusHeaderItem.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IoniconName } from '../types';

interface StatusHeaderItemProps {
    title: string;
    iconName: IoniconName;
    colors: any;
    styles: any;
    count?: number;
    isCollapsed?: boolean;
    onToggle?: () => void;
}

export const StatusHeaderItem = ({ title, iconName, colors, styles, count, isCollapsed, onToggle }: StatusHeaderItemProps) => (
    <TouchableOpacity
        style={styles.statusHeaderItem}
        onPress={onToggle}
        activeOpacity={onToggle ? 0.7 : 1}
        disabled={!onToggle}
    >
        <Ionicons name={iconName} size={16} color={colors.textHeader} />
        <Text style={styles.statusHeaderText}>{title}</Text>
        <View style={{ flex: 1 }} />
        {count !== undefined && (
            <View style={styles.statusHeaderCount}>
                <Text style={styles.statusHeaderCountText}>{count}</Text>
            </View>
        )}
        {onToggle !== undefined && (
            <Ionicons
                name={isCollapsed ? 'chevron-down-outline' : 'chevron-up-outline'}
                size={14}
                color={colors.textMuted}
                style={{ marginLeft: 6 }}
            />
        )}
    </TouchableOpacity>
);

StatusHeaderItem.displayName = 'StatusHeaderItem';
