// app/home/components/RoundHeaderItem.tsx
import React from 'react';
import { View, Text } from 'react-native';

interface RoundHeaderItemProps {
    roundName: string;
    styles: any;
    prizeAmount?: string;
}

export const RoundHeaderItem = ({ roundName, styles, prizeAmount }: RoundHeaderItemProps) => (
    <View style={styles.roundHeaderItem}>
        <View style={styles.roundHeaderLine} />
        <View style={{ alignItems: 'center' }}>
            <Text style={styles.roundHeaderText}>{roundName}</Text>
            {!!prizeAmount && (
                <Text style={[styles.roundHeaderText, { fontSize: 10, opacity: 0.7, marginTop: 1 }]}>
                    Losers: {prizeAmount}
                </Text>
            )}
        </View>
        <View style={styles.roundHeaderLine} />
    </View>
);

RoundHeaderItem.displayName = 'RoundHeaderItem';
