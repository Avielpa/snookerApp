// app/home/components/StatusHeaderItem.tsx
import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IoniconName } from '../types';

interface StatusHeaderItemProps {
    title: string;
    iconName: IoniconName;
    colors: any;
    styles: any;
}

export const StatusHeaderItem = ({ title, iconName, colors, styles }: StatusHeaderItemProps) => (
    <View style={styles.statusHeaderItem}>
        <Ionicons name={iconName} size={18} color={colors.textHeader} />
        <Text style={styles.statusHeaderText}>{title}</Text>
    </View>
);

StatusHeaderItem.displayName = 'StatusHeaderItem';
