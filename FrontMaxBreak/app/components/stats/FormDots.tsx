// app/components/stats/FormDots.tsx
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface FormDotsProps {
    form: string[]; // ['W', 'L', 'W', ...] most-recent first
}

export const FormDots = ({ form }: FormDotsProps) => {
    if (!form || form.length === 0) return null;

    return (
        <View style={styles.container}>
            <Text style={styles.label}>Recent Form</Text>
            <View style={styles.dotsRow}>
                {form.slice(0, 10).map((result, i) => (
                    <View
                        key={i}
                        style={[styles.dot, result === 'W' ? styles.win : styles.loss]}
                    />
                ))}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginTop: 8,
        marginBottom: 4,
    },
    label: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
        marginBottom: 6,
    },
    dotsRow: {
        flexDirection: 'row',
        gap: 6,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    win: {
        backgroundColor: '#22C55E',
    },
    loss: {
        backgroundColor: '#EF4444',
    },
});
