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

    const p1Won = isFinished && match.winner_id != null && match.player1_name !== 'TBD';
    const p2Won = isFinished && match.winner_id != null && !p1Won;

    const p1Flag = match.player1_nationality ? getNationalityFlag(match.player1_nationality) + ' ' : '';
    const p2Flag = match.player2_nationality ? getNationalityFlag(match.player2_nationality) + ' ' : '';

    return (
        <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderBottomWidth: 0.5,
            borderBottomColor: 'rgba(255,255,255,0.06)',
        }}>
            {isLive && (
                <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: LIVE_COLOR, marginRight: 6 }} />
            )}
            <Text
                numberOfLines={1}
                style={{ flex: 1, color: p1Won ? '#FFFFFF' : '#9CA3AF', fontSize: 12, fontFamily: p1Won ? 'PoppinsBold' : 'PoppinsRegular' }}
            >
                {p1Flag}{match.player1_name}
            </Text>
            <Text style={{ color: isLive ? LIVE_COLOR : '#9CA3AF', fontSize: 13, fontFamily: 'PoppinsBold', marginHorizontal: 8, minWidth: 36, textAlign: 'center' }}>
                {hasScore ? `${match.score1}–${match.score2}` : 'vs'}
            </Text>
            <Text
                numberOfLines={1}
                style={{ flex: 1, color: p2Won ? '#FFFFFF' : '#9CA3AF', fontSize: 12, fontFamily: p2Won ? 'PoppinsBold' : 'PoppinsRegular', textAlign: 'right' }}
            >
                {match.player2_name}{p2Flag ? ' ' + p2Flag : ''}
            </Text>
        </View>
    );
}
