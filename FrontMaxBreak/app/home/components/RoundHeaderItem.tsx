// app/home/components/RoundHeaderItem.tsx
import React from 'react';
import { View, Text } from 'react-native';

interface RoundHeaderItemProps {
    roundName: string;
    styles: any;
}

export const RoundHeaderItem = ({ roundName, styles }: RoundHeaderItemProps) => (
    <View style={styles.roundHeaderItem}>
        <Text style={styles.roundHeaderText}>{roundName}</Text>
    </View>
);

RoundHeaderItem.displayName = 'RoundHeaderItem';
