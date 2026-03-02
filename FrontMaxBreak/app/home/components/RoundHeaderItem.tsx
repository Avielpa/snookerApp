// app/home/components/RoundHeaderItem.tsx
import React from 'react';
import { View, Text } from 'react-native';

interface RoundHeaderItemProps {
    roundName: string;
    styles: any;
}

export const RoundHeaderItem = ({ roundName, styles }: RoundHeaderItemProps) => (
    <View style={styles.roundHeaderItem}>
        <View style={styles.roundHeaderLine} />
        <Text style={styles.roundHeaderText}>{roundName}</Text>
        <View style={styles.roundHeaderLine} />
    </View>
);

RoundHeaderItem.displayName = 'RoundHeaderItem';
