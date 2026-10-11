import { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export default function TranscriptDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [transcript, setTranscript] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();
  const router = useRouter();

  useEffect(() => { fetchTranscript(); }, [id]);

  const fetchTranscript = async () => {
    try {
      const { data, error } = await supabase
        .from('transcripts')
        .select(`
          *,
          utterances ( speaker_label, text, start_time, end_time, order_index ),
          transcript_tags ( tags ( id, name, color ) )
        `)
        .eq('id', id)
        .eq('user_id', session?.user.id)
        .single();

      if (error) throw error;
      // Sort utterances by order_index
      if (data.utterances) {
        data.utterances.sort((a: any, b: any) => a.order_index - b.order_index);
      }
      setTranscript(data);
    } catch {
      Alert.alert('Error', 'Failed to load transcript');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Transcript', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const { error } = await supabase
            .from('transcripts').delete().eq('id', id);
          if (error) { Alert.alert('Error', 'Delete failed'); return; }
          router.back();
        },
      },
    ]);
  };

  const fmtTime = (s?: number) => {
    if (s == null) return '';
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `[${m}:${sec.toString().padStart(2, '0')}] `;
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#007AFF" /></View>;
  }
  if (!transcript) return null;

  const tags: any[] = (transcript.transcript_tags ?? []).map((tt: any) => tt.tags).filter(Boolean);
  const utterances: any[] = transcript.utterances ?? [];

  // Group consecutive utterances by same speaker
  const grouped: { speaker: string; lines: string[] }[] = [];
  utterances.forEach(u => {
    const last = grouped[grouped.length - 1];
    if (last && last.speaker === u.speaker_label) {
      last.lines.push(`${fmtTime(u.start_time)}${u.text}`);
    } else {
      grouped.push({ speaker: u.speaker_label, lines: [`${fmtTime(u.start_time)}${u.text}`] });
    }
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#0f172a" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{transcript.title}</Text>
        <TouchableOpacity onPress={handleDelete}>
          <Ionicons name="trash-outline" size={22} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Meta */}
        <Text style={styles.meta}>
          {new Date(transcript.created_at).toLocaleString()}
          {transcript.duration_seconds
            ? `  ·  ${Math.round(transcript.duration_seconds)}s`
            : ''}
          {transcript.speaker_count > 1 ? `  ·  ${transcript.speaker_count} speakers` : ''}
        </Text>

        {/* Tags */}
        {tags.length > 0 && (
          <View style={styles.tags}>
            {tags.map((tag: any) => (
              <View key={tag.id} style={[styles.tag, { backgroundColor: tag.color + '33' }]}>
                <Text style={[styles.tagText, { color: tag.color }]}>{tag.name}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Summary */}
        {transcript.summary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Summary</Text>
            <Text style={styles.summaryText}>{transcript.summary}</Text>
          </View>
        )}

        {/* Conversation */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {utterances.length > 0 ? 'Conversation' : 'Transcript'}
          </Text>

          {grouped.length > 0 ? (
            grouped.map((group, i) => (
              <View key={i} style={styles.utteranceGroup}>
                <Text style={styles.speakerLabel}>{group.speaker}</Text>
                <Text style={styles.utteranceText}>{group.lines.join(' ')}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.fullText}>{transcript.full_text || 'No transcript available.'}</Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#e2e8f0',
  },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '600', color: '#0f172a' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20 },
  meta: { fontSize: 13, color: '#94a3b8', marginBottom: 12 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 },
  tag: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  tagText: { fontSize: 13, fontWeight: '500' },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 12 },
  summaryText: { fontSize: 15, color: '#334155', lineHeight: 22 },
  utteranceGroup: { marginBottom: 16 },
  speakerLabel: { fontSize: 13, fontWeight: '700', color: '#007AFF', marginBottom: 4 },
  utteranceText: { fontSize: 15, color: '#1e293b', lineHeight: 22 },
  fullText: { fontSize: 15, color: '#334155', lineHeight: 24 },
});
