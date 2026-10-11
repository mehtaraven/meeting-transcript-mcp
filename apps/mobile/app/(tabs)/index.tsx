import { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import type { Transcript } from '@meeting-transcript/shared';

const STATUS_COLORS: Record<string, string> = {
  completed: '#22c55e',
  processing: '#f59e0b',
  pending: '#94a3b8',
  failed: '#ef4444',
};

export default function TranscriptsScreen() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { session } = useAuth();
  const router = useRouter();

  const fetchTranscripts = async () => {
    try {
      const { data, error } = await supabase
        .from('transcripts')
        .select(`
          id, title, full_text, summary, status, source,
          duration_seconds, speaker_count, created_at,
          transcript_tags ( tags ( id, name, color ) )
        `)
        .eq('user_id', session?.user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTranscripts((data ?? []) as unknown as Transcript[]);
    } catch (error) {
      console.error('Error fetching transcripts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { 
    if (session?.user.id) fetchTranscripts(); 
  }, [session?.user.id]);

  const onRefresh = () => { setRefreshing(true); fetchTranscripts(); };

  const deleteTranscript = async (id: string) => {
    Alert.alert('Delete Transcript', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          setDeletingId(id);
          try {
            const apiUrl = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_BACKEND_URL;
            const response = await fetch(`${apiUrl}/api/transcripts/${id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${session?.access_token}` },
            });
            if (!response.ok) throw new Error('Delete failed');
            setTranscripts(prev => prev.filter(t => t.id !== id));
          } catch (error) {
            console.error('Delete error:', error);
            Alert.alert('Error', 'Failed to delete transcript');
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const formatDuration = (secs?: number) => {
    if (!secs) return '';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}m ${s}s`;
  };

  const renderItem = ({ item }: { item: any }) => {
    const tags: any[] = (item.transcript_tags ?? []).map((tt: any) => tt.tags).filter(Boolean);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => router.push(`/transcript/${item.id}`)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
          <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[item.status] ?? '#94a3b8' }]} />
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => deleteTranscript(item.id)}
            disabled={deletingId === item.id}
          >
            {deletingId === item.id
              ? <ActivityIndicator size="small" color="#ef4444" />
              : <Ionicons name="trash-outline" size={18} color="#ef4444" />
            }
          </TouchableOpacity>
        </View>

        <Text style={styles.meta}>
          {new Date(item.created_at).toLocaleDateString()}
          {item.duration_seconds ? `  ·  ${formatDuration(item.duration_seconds)}` : ''}
          {item.speaker_count > 1 ? `  ·  ${item.speaker_count} speakers` : ''}
        </Text>

        {tags.length > 0 && (
          <View style={styles.tags}>
            {tags.map((tag: any) => (
              <View key={tag.id} style={[styles.tag, { backgroundColor: tag.color + '33' }]}>
                <Text style={[styles.tagText, { color: tag.color }]}>{tag.name}</Text>
              </View>
            ))}
          </View>
        )}

        {item.summary ? (
          <Text style={styles.preview} numberOfLines={2}>{item.summary}</Text>
        ) : (
          <Text style={styles.preview} numberOfLines={2}>{item.full_text}</Text>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return <View style={styles.center}><Text>Loading…</Text></View>;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={transcripts}
        renderItem={renderItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>No transcripts yet</Text>
            <Text style={styles.emptyHint}>Tap Record to create your first one</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8fafc' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  list: { padding: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  title: { flex: 1, fontSize: 17, fontWeight: '600', color: '#0f172a' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginLeft: 8 },
  deleteBtn: { padding: 4, marginLeft: 8 },
  meta: { fontSize: 12, color: '#94a3b8', marginBottom: 8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8, gap: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  tagText: { fontSize: 12, fontWeight: '500' },
  preview: { fontSize: 14, color: '#64748b', lineHeight: 20 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#1e293b', marginBottom: 6 },
  emptyHint: { fontSize: 14, color: '#94a3b8' },
});
