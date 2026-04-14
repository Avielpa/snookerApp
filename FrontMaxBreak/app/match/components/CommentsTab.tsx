// app/match/components/CommentsTab.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Alert,
    StyleSheet,
    KeyboardAvoidingView,
    Platform,
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

    const s = styles(colors);

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
        try {
            await AsyncStorage.setItem(AUTHOR_NAME_KEY, name);
        } catch {}
    };

    const handlePost = async () => {
        const trimmedName = authorName.trim();
        const trimmedText = text.trim();
        if (!trimmedName) {
            Alert.alert('Name required', 'Please enter your display name.');
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
        } catch (e) {
            Alert.alert('Error', 'Could not post comment. Please try again.');
            logger.error('[CommentsTab] post failed', e);
        } finally {
            setPosting(false);
        }
    };

    const handleDelete = (commentId: number) => {
        Alert.alert('Delete comment', 'Remove this comment?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
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
        // Optimistic update
        setComments(prev =>
            prev.map(c => {
                if (c.id !== commentId) return c;
                const willLike = !c.liked_by_me;
                return {
                    ...c,
                    liked_by_me: willLike,
                    likes_count: c.likes_count + (willLike ? 1 : -1),
                };
            }),
        );
        try {
            const result = await toggleLike(matchApiId, commentId, deviceId);
            setComments(prev =>
                prev.map(c =>
                    c.id === commentId
                        ? { ...c, liked_by_me: result.liked, likes_count: result.likes_count }
                        : c,
                ),
            );
        } catch {
            // Revert optimistic update on failure
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

    const renderComment = ({ item }: { item: Comment }) => (
        <View style={s.commentCard}>
            <View style={s.commentHeader}>
                <View style={s.commentAuthorRow}>
                    <View style={s.avatar}>
                        <Text style={s.avatarText}>{item.author_name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View>
                        <Text style={s.authorName}>{item.author_name}</Text>
                        <Text style={s.commentTime}>{formatTime(item.created_at)}</Text>
                    </View>
                </View>
                <View style={s.commentActions}>
                    <TouchableOpacity style={s.likeButton} onPress={() => handleLike(item.id)} activeOpacity={0.7}>
                        <Ionicons
                            name={item.liked_by_me ? 'heart' : 'heart-outline'}
                            size={16}
                            color={item.liked_by_me ? colors.primary : colors.textSecondary}
                        />
                        {item.likes_count > 0 && (
                            <Text style={[s.likeCount, item.liked_by_me && { color: colors.primary }]}>
                                {item.likes_count}
                            </Text>
                        )}
                    </TouchableOpacity>
                    {item.is_mine && (
                        <TouchableOpacity onPress={() => handleDelete(item.id)} activeOpacity={0.7} style={s.deleteButton}>
                            <Ionicons name="trash-outline" size={15} color={colors.textMuted} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
            <Text style={s.commentText}>{item.text}</Text>
        </View>
    );

    return (
        <KeyboardAvoidingView
            style={s.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={100}
        >
            {/* Compose area */}
            <View style={s.composeCard}>
                <TouchableOpacity
                    style={s.nameRow}
                    onPress={() => { setEditingName(true); setTimeout(() => nameInputRef.current?.focus(), 50); }}
                    activeOpacity={0.8}
                >
                    {editingName ? (
                        <TextInput
                            ref={nameInputRef}
                            style={s.nameInput}
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
                        <View style={s.nameDisplay}>
                            <Ionicons name="person-circle-outline" size={16} color={colors.textSecondary} />
                            <Text style={s.nameDisplayText} numberOfLines={1}>
                                {authorName || 'Tap to set your name'}
                            </Text>
                            <Ionicons name="pencil-outline" size={12} color={colors.textMuted} style={{ marginLeft: 4 }} />
                        </View>
                    )}
                </TouchableOpacity>

                <View style={s.inputRow}>
                    <TextInput
                        style={s.textInput}
                        value={text}
                        onChangeText={setText}
                        placeholder="Write a comment..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        maxLength={1000}
                    />
                    <TouchableOpacity
                        style={[s.postButton, (!text.trim() || posting) && s.postButtonDisabled]}
                        onPress={handlePost}
                        disabled={!text.trim() || posting}
                        activeOpacity={0.7}
                    >
                        {posting ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Ionicons name="send" size={18} color="#fff" />
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* Comments list */}
            {loading ? (
                <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
            ) : comments.length === 0 ? (
                <View style={s.emptyState}>
                    <Ionicons name="chatbubbles-outline" size={40} color={colors.textMuted} />
                    <Text style={s.emptyText}>No comments yet</Text>
                    <Text style={s.emptySubText}>Be the first to share your thoughts!</Text>
                </View>
            ) : (
                <FlatList
                    data={comments}
                    keyExtractor={item => String(item.id)}
                    renderItem={renderComment}
                    contentContainerStyle={{ paddingBottom: 24 }}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </KeyboardAvoidingView>
    );
}

const styles = (colors: any) =>
    StyleSheet.create({
        container: {
            flex: 1,
            paddingHorizontal: 12,
            paddingTop: 12,
        },
        composeCard: {
            backgroundColor: colors.cardBackground,
            borderRadius: 12,
            padding: 12,
            marginBottom: 12,
            borderWidth: 1,
            borderColor: 'rgba(255,183,77,0.15)',
        },
        nameRow: {
            marginBottom: 8,
        },
        nameDisplay: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        nameDisplayText: {
            color: colors.textSecondary,
            fontSize: 13,
            fontFamily: 'PoppinsMedium',
            flex: 1,
        },
        nameInput: {
            color: colors.textPrimary,
            fontSize: 13,
            fontFamily: 'PoppinsMedium',
            borderBottomWidth: 1,
            borderBottomColor: colors.primary,
            paddingVertical: 2,
        },
        inputRow: {
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 8,
        },
        textInput: {
            flex: 1,
            color: colors.textPrimary,
            fontSize: 14,
            fontFamily: 'Poppins',
            backgroundColor: 'rgba(255,255,255,0.05)',
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 8,
            maxHeight: 100,
            minHeight: 40,
        },
        postButton: {
            backgroundColor: colors.primary,
            borderRadius: 8,
            width: 40,
            height: 40,
            alignItems: 'center',
            justifyContent: 'center',
        },
        postButtonDisabled: {
            opacity: 0.4,
        },
        commentCard: {
            backgroundColor: colors.cardBackground,
            borderRadius: 10,
            padding: 12,
            marginBottom: 8,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.06)',
        },
        commentHeader: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 6,
        },
        commentAuthorRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            flex: 1,
        },
        avatar: {
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: 'rgba(255,183,77,0.25)',
            alignItems: 'center',
            justifyContent: 'center',
        },
        avatarText: {
            color: '#FFB74D',
            fontSize: 14,
            fontFamily: 'PoppinsBold',
        },
        authorName: {
            color: colors.textPrimary,
            fontSize: 13,
            fontFamily: 'PoppinsMedium',
        },
        commentTime: {
            color: colors.textMuted,
            fontSize: 11,
            fontFamily: 'Poppins',
        },
        commentActions: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
        },
        likeButton: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 3,
            padding: 4,
        },
        likeCount: {
            color: colors.textSecondary,
            fontSize: 12,
            fontFamily: 'PoppinsMedium',
        },
        deleteButton: {
            padding: 4,
        },
        commentText: {
            color: colors.textPrimary,
            fontSize: 14,
            fontFamily: 'Poppins',
            lineHeight: 20,
        },
        emptyState: {
            alignItems: 'center',
            paddingTop: 48,
            gap: 8,
        },
        emptyText: {
            color: colors.textSecondary,
            fontSize: 16,
            fontFamily: 'PoppinsMedium',
        },
        emptySubText: {
            color: colors.textMuted,
            fontSize: 13,
            fontFamily: 'Poppins',
        },
    });
