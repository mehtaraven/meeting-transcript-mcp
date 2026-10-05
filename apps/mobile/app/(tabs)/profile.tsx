import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
}

export default function ProfileScreen() {
  const { session, signOut } = useAuth();
  const router = useRouter();

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [isLoadingKeys, setIsLoadingKeys] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    loadKeys();
  }, [session]);

  const loadKeys = async () => {
    if (!session?.access_token) return;
    setIsLoadingKeys(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/keys`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch API keys');
      const data = await response.json();
      setApiKeys(data);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not load API keys');
    } finally {
      setIsLoadingKeys(false);
    }
  };

  const generateKey = async () => {
    if (!session?.access_token) return;
    setIsGenerating(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/keys`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'MCP Key' }),
      });
      if (!response.ok) throw new Error('Failed to generate API key');
      const data = await response.json();
      setNewKey(data.key);
      await loadKeys();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Could not generate API key');
    } finally {
      setIsGenerating(false);
    }
  };

  const revokeKey = async (id: string) => {
    if (!session?.access_token) return;
    Alert.alert('Revoke Key', 'Are you sure you want to revoke this API key? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await fetch(`${BACKEND_URL}/api/keys/${id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${session.access_token}` },
            });
            if (!response.ok) throw new Error('Failed to revoke API key');
            setApiKeys((prev) => prev.filter((k) => k.id !== id));
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Could not revoke API key');
          }
        },
      },
    ]);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
            router.replace('/(auth)/login');
          } catch (error: any) {
            Alert.alert('Error', error.message);
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person" size={64} color="#fff" />
        </View>
        <Text style={styles.email}>{session?.user.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.aboutText}>
          Meeting Transcript App helps you record, transcribe, and manage your
          meeting conversations with AI-powered features.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>MCP Integration</Text>
        <Text style={styles.infoText}>
          Generate an API key to connect Claude AI to your transcripts via MCP.
        </Text>

        {/* One-time new key display */}
        {newKey && (
          <View style={styles.keyBox}>
            <Text style={styles.newKeyWarning}>
              Save this key now — it won't be shown again.
            </Text>
            <TextInput
              style={styles.keyText}
              value={newKey}
              editable={false}
              selectTextOnFocus={true}
              multiline={false}
            />
            <View style={styles.keyBoxActions}>
              <TouchableOpacity style={styles.copyButton} onPress={() => {
                // TextInput with selectTextOnFocus lets users copy manually.
                // Alert guides them to long-press the key above to select and copy.
                Alert.alert('Copy Key', 'Long-press the key text above to select and copy it.');
              }}>
                <Text style={styles.copyButtonText}>Copy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.doneButton} onPress={() => setNewKey(null)}>
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Generate button */}
        <TouchableOpacity
          style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
          onPress={generateKey}
          disabled={isGenerating}
        >
          {isGenerating ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.generateButtonText}>Generate New API Key</Text>
          )}
        </TouchableOpacity>

        {/* Keys list */}
        {isLoadingKeys ? (
          <ActivityIndicator size="small" color="#007AFF" style={styles.loadingSpinner} />
        ) : apiKeys.length === 0 ? (
          <Text style={styles.emptyText}>No API keys yet. Generate one to get started.</Text>
        ) : (
          apiKeys.map((key) => (
            <View key={key.id} style={styles.keyRow}>
              <View style={styles.keyInfo}>
                <Text style={styles.keyName}>{key.name}</Text>
                <Text style={styles.keyMeta}>
                  {key.key_prefix}... · Created {formatDate(key.created_at)}
                </Text>
              </View>
              <TouchableOpacity style={styles.revokeButton} onPress={() => revokeKey(key.id)}>
                <Text style={styles.revokeText}>Revoke</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Ionicons name="log-out" size={24} color="#FF3B30" />
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007AFF',
    padding: 32,
    alignItems: 'center',
  },
  avatarContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  email: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  section: {
    backgroundColor: '#fff',
    padding: 20,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  aboutText: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  // New key one-time display
  keyBox: {
    backgroundColor: '#FFF9E6',
    borderWidth: 1,
    borderColor: '#F0C040',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  newKeyWarning: {
    fontSize: 12,
    color: '#B8860B',
    fontWeight: '600',
    marginBottom: 8,
  },
  keyText: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#333',
    backgroundColor: '#fff',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
  },
  keyBoxActions: {
    flexDirection: 'row',
    gap: 8,
  },
  copyButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  doneButton: {
    backgroundColor: '#E0E0E0',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  doneButtonText: {
    color: '#333',
    fontSize: 14,
    fontWeight: '600',
  },
  // Generate button
  generateButton: {
    backgroundColor: '#007AFF',
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  // Loading / empty state
  loadingSpinner: {
    marginVertical: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    paddingVertical: 12,
  },
  // Key list row
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  keyInfo: {
    flex: 1,
  },
  keyName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  keyMeta: {
    fontSize: 12,
    color: '#888',
  },
  revokeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  revokeText: {
    color: '#FF3B30',
    fontSize: 13,
    fontWeight: '600',
  },
  // Sign out
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    padding: 16,
    margin: 20,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#FF3B30',
  },
  signOutText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#FF3B30',
    fontWeight: '600',
  },
});
