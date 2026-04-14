// app/match/components/CommentsTab.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getOrCreateDeviceId } from '../../../utils/deviceIdentity';
import { getComments, postComment, deleteComment, toggleLike, Comment } from '../../../services/commentService';
import { logger } from '../../../utils/logger';

const AUTHOR_NAME_KEY = '@maxbreak_author_name';

interface CommentsTabProps {
    matchApiId: number;
    colors: any;
}

export function CommentsTab({ matchApiId, colors }: CommentsTabProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(true);
    const [posting, setPosting] = useState(false);
    const [deviceId, setDeviceId] = useState('');
    const [authorName, setAuthorName] = useState('');
    const [text, setText] = useState('');
    const [editingName, setEditingName] = useState(false);
    const nameInputRef = useRef<TextInput>(null);

    // Load device ID and saved author name on mount
    useEffect(() => {
        (async () => {
            const id = await getOrCreateDeviceId();
            setDeviceId(id);
            const saved = await AsyncStorage.getItem(AUTHOR_NAME_KEY);
            if (saved) setAuthorName(saved);
        })();
    }, []);

    const fetchComments = useCallback(async () => {
        if (!deviceId) return;
        try {
            const data = await getComments(matchApiId, deviceId);
            setComments(data);
        } catch (e) {
            logger.error('[CommentsTab] fetch failed', e);
        } finally {
            setLoading(false);
        }
    }, [matchApiId, deviceId]);

    useEffect(() => {
        if (deviceId) fetchComments();
    }, [fetchComments, deviceId]);

    const saveAuthorName = async (name: string) => {
        setAuthorName(name);
        try { await AsyncStorage.setItem(AUTHOR_NAME_KEY, name); } catch {}
    };

    const handlePost = async () => {
        const trimmedName = authorName.trim();
        const trimmedText = text.trim();
        if (!trimmedName) {
            Alert.alert('Name required', 'Please enter your display name first.');
            return;
        }
        if (!trimmedText) return;
        if (trimmedText.length > 1000) {
            Alert.alert('Too long', 'Comment must be 1000 characters or fewer.');
            return;
        }
        setPosting(true);
        try {
            await saveAuthorName(trimmedName);
            const newComment = await postComment(matchApiId, deviceId, trimmedName, trimmedText);
            setComments(prev => [newComment, ...prev]);
            setText('');
        } catch {
            Alert.alert('Error', 'Could not post comment. Please try again.');
        } finally {
            setPosting(false);
        }
    };

    const handleDelete = (commentId: number) => {
        Alert.alert('Delete comment', 'Remove this comment?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteComment(matchApiId, commentId, deviceId);
                        setComments(prev => prev.filter(c => c.id !== commentId));
                    } catch {
                        Alert.alert('Error', 'Could not delete comment.');
                    }
                },
            },
        ]);
    };

    const handleLike = async (commentId: number) => {
        setComments(prev => prev.map(c => {
            if (c.id !== commentId) return c;
            const willLike = !c.liked_by_me;
            return { ...c, liked_by_me: willLike, likes_count: c.likes_count + (willLike ? 1 : -1) };
        }));
        try {
            const result = await toggleLike(matchApiId, commentId, deviceId);
            setComments(prev => prev.map(c =>
                c.id === commentId ? { ...c, liked_by_me: result.liked, likes_count: result.likes_count } : c
            ));
        } catch {
            fetchComments();
        }
    };

    const formatTime = (iso: string) => {
        const d = new Date(iso);
        const now = new Date();
        const diffMin = Math.floor((now.getTime() - d.getTime()) / 60000);
        if (diffMin < 1) return 'just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffH = Math.floor(diffMin / 60);
        if (diffH < 24) return `${diffH}h ago`;
        return d.toLocaleDateString();
    };

    return (
        <ScrollView showsVerticalScrollIndicator={false}>
            {/* ── Compose area ── */}
            <View style={[s.card, { marginBottom: 12 }]}>
                {/* Name row */}
                <TouchableOpacity
                    style={s.nameRow}
                    onPress={() => { setEditingName(true); setTimeout(() => nameInputRef.current?.focus(), 50); }}
                    activeOpacity={0.8}
                >
                    <Ionicons name="person-circle-outline" size={16} color={colors.textSecondary} />
                    {editingName ? (
                        <TextInput
                            ref={nameInputRef}
                            style={[s.nameInput, { color: colors.textPrimary, borderBottomColor: colors.primary }]}
                            value={authorName}
                            onChangeText={setAuthorName}
                            onBlur={async () => {
                                setEditingName(false);
                                if (authorName.trim()) await saveAuthorName(authorName.trim());
                            }}
                            placeholder="Your name (e.g. CueBall)"
                            placeholderTextColor={colors.textMuted}
                            maxLength={100}
                            returnKeyType="done"
                        />
                    ) : (
                        <Text style={[s.nameText, { color: authorName ? colors.textSecondary : colors.textMuted }]}>
                            {authorName || 'Tap to set your name'}
                        </Text>
                    )}
                    {!editingName && (
                        <Ionicons name="pencil-outline" size={12} color={colors.textMuted} style={{ marginLeft: 4 }} />
                    )}
                </TouchableOpacity>

                {/* Text input + Send */}
                <View style={s.inputRow}>
                    <TextInput
                        style={[s.textInput, { color: colors.textPrimary }]}
                        value={text}
                        onChangeText={setText}
                        placeholder="Write a comment..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        maxLength={1000}
                    />
                    <TouchableOpacity
                        style={[s.sendBtn, { backgroundColor: colors.primary, opacity: (!text.trim() || posting) ? 0.4 : 1 }]}
                        onPress={handlePost}
                        disabled={!text.trim() || posting}
                        activeOpacity={0.7}
                    >
                        {posting
                            ? <ActivityIndicator size="small" color="#fff" />
                            : <Ionicons name="send" size={18} color="#fff" />
                        }
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── Comments list ── */}
            {loading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
            ) : comments.length === 0 ? (
                <View style={s.empty}>
                    <Ionicons name="chatbubbles-outline" size={40} color={colors.textMuted} />
                    <Text style={[s.emptyTitle, { color: colors.textSecondary }]}>No comments yet</Text>
                    <Text style={[s.emptySub, { color: colors.textMuted }]}>Be the first to share your thoughts!</Text>
                </View>
            ) : (
                comments.map(item => (
                    <View key={item.id} style={[s.card, { marginBottom: 8 }]}>
                        {/* Header */}
                        <View style={s.commentHeader}>
                            <View style={s.authorRow}>
                                <View style={s.avatar}>
                                    <Text style={s.avatarLetter}>
                                        {item.author_name.charAt(0).toUpperCase()}
                                    </Text>
                                </View>
                                <View>
                                    <Text style={[s.authorName, { color: colors.textPrimary }]}>{item.author_name}</Text>
                                    <Text style={[s.timeText, { color: colors.textMuted }]}>{formatTime(item.created_at)}</Text>
                                </View>
                            </View>
                            <View style={s.actionRow}>
                                <TouchableOpacity style={s.likeBtn} onPress={() => handleLike(item.id)} activeOpacity={0.7}>
                                    <Ionicons
                                        name={item.liked_by_me ? 'heart' : 'heart-outline'}
                                        size={16}
                                        color={item.liked_by_me ? colors.primary : colors.textSecondary}
                                    />
                                    {item.likes_count > 0 && (
                                        <Text style={[s.likeCount, { color: item.liked_by_me ? colors.primary : colors.textSecondary }]}>
                                            {item.likes_count}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                                {item.is_mine && (
                                    <TouchableOpacity onPress={() => handleDelete(item.id)} activeOpacity={0.7} style={{ padding: 4 }}>
                                        <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                        {/* Body */}
                        <Text style={[s.commentText, { color: colors.textPrimary }]}>{item.text}</Text>
                    </View>
                ))
            )}
            <View style={{ height: 24 }} />
        </ScrollView>
    );
}

const s = StyleSheet.create({
    card: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    nameText: {
        fontSize: 13,
        fontFamily: 'PoppinsMedium',
        marginLeft: 6,
        flex: 1,
    },
    nameInput: {
        fontSize: 13,
        fontFamily: 'PoppinsMedium',
        marginLeft: 6,
        flex: 1,
        borderBottomWidth: 1,
        paddingVertical: 2,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    textInput: {
        flex: 1,
        fontSize: 14,
        fontFamily: 'Poppins',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        maxHeight: 100,
        minHeight: 40,
        marginRight: 8,
    },
    sendBtn: {
        borderRadius: 8,
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    empty: {
        alignItems: 'center',
        paddingTop: 48,
    },
    emptyTitle: {
        fontSize: 16,
        fontFamily: 'PoppinsMedium',
        marginTop: 8,
    },
    emptySub: {
        fontSize: 13,
        fontFamily: 'Poppins',
        marginTop: 4,
    },
    commentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 6,
    },
    authorRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    avatar: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(255,183,77,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    avatarLetter: {
        color: '#FFB74D',
        fontSize: 14,
        fontFamily: 'PoppinsBold',
    },
    authorName: {
        fontSize: 13,
        fontFamily: 'PoppinsMedium',
    },
    timeText: {
        fontSize: 11,
        fontFamily: 'Poppins',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    likeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 4,
        marginRight: 4,
    },
    likeCount: {
        fontSize: 12,
        fontFamily: 'PoppinsMedium',
        marginLeft: 3,
    },
    commentText: {
        fontSize: 14,
        fontFamily: 'Poppins',
        lineHeight: 20,
    },
});
