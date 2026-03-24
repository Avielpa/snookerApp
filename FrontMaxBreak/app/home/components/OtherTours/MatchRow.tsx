// MatchRow.tsx — one match: flags + names + score

import React from 'react';
import { View, Text } from 'react-native';
import { getNationalityFlag } from '../../../../utils/nationalityFlag';
import { OtherTourMatch } from './groupUtils';

const LIVE_COLOR = '#22C55E';

interface Props {
    match: OtherTourMatch;
}

export function MatchRow({ match }: Props) {
    const isLive = match.status === 1;
    const isFinished = match.status === 2 || match.status === 3;
    const hasScore = (isLive || isFinished) && match.score1 != null && match.score2 != null;

    // Determine winner by score — no need for winner_id comparison
    const p1Won = isFinished && hasScore && (match.score1 ?? 0) > (match.score2 ?? 0);
    const p2Won = isFinished && hasScore && (match.score2 ?? 0) > (match.score1 ?? 0);

    const p1Flag = match.player1_nationality ? getNationalityFlag(match.player1_nationality) + ' ' : '';
    const p2Flag = match.player2_nationality ? getNationalityFlag(match.player2_nationality) + ' ' : '';

    return (
        <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 7,
            paddingHorizontal: 12,
            borderBottomWidth: 0.5,
            borderBottomColor: 'rgba(255,255,255,0.06)',
        }}>
            {isLive && (
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: LIVE_COLOR, marginRight: 6 }} />
            )}
            <Text
                numberOfLines={1}
                style={{
                    flex: 1,
                    color: p2Won ? '#4B5563' : '#E5E7EB',
                    fontSize: 12,
                    fontFamily: p1Won ? 'PoppinsBold' : 'PoppinsRegular',
                    opacity: p2Won ? 0.7 : 1,
                }}
            >
                {p1Flag}{match.player1_name}
            </Text>
            <Text style={{
                color: isLive ? LIVE_COLOR : (hasScore ? '#D1D5DB' : '#4B5563'),
                fontSize: 13,
                fontFamily: 'PoppinsBold',
                marginHorizontal: 8,
                minWidth: 36,
                textAlign: 'center',
            }}>
                {hasScore ? `${match.score1}–${match.score2}` : 'vs'}
            </Text>
            <Text
                numberOfLines={1}
                style={{
                    flex: 1,
                    color: p1Won ? '#4B5563' : '#E5E7EB',
                    fontSize: 12,
                    fontFamily: p2Won ? 'PoppinsBold' : 'PoppinsRegular',
                    textAlign: 'right',
                    opacity: p1Won ? 0.7 : 1,
                }}
            >
                {match.player2_name}{p2Flag ? ' ' + p2Flag : ''}
            </Text>
        </View>
    );
}
