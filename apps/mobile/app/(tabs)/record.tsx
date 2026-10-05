import { useState, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  TextInput,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function RecordScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [title, setTitle] = useState('');
  const [projectTags, setProjectTags] = useState('');
  const [uploading, setUploading] = useState(false);
  const { session } = useAuth();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const isWeb = Platform.OS === 'web';

  const startRecording = async () => {
    if (isWeb) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        chunksRef.current = [];
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };
        mediaRecorder.onstop = async () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const url = URL.createObjectURL(blob);
          await uploadAudio(url, blob);
          URL.revokeObjectURL(url);
          stream.getTracks().forEach((t) => t.stop());
        };
        mediaRecorder.start();
        mediaRecorderRef.current = mediaRecorder;
        setIsRecording(true);
      } catch (error) {
        console.error('Failed to start recording:', error);
        Alert.alert('Error', 'Failed to start recording');
      }
    } else {
      Alert.alert(
        'Dev Build Required',
        'Live microphone recording requires a development build. Use "Upload Audio File" instead.'
      );
    }
  };

  const stopRecording = async () => {
    if (isWeb) {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
      }
    }
    // no-op on native (button is only reachable on web when isRecording is true)
  };

  const pickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
      });

      if (result.assets && result.assets[0]) {
        await uploadAudio(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking file:', error);
      Alert.alert('Error', 'Failed to pick audio file');
    }
  };

  const uploadAudio = async (uri: string, blob?: Blob) => {
    if (!title) {
      Alert.alert('Title required', 'Please enter a title for the transcript');
      return;
    }

    setUploading(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      const token = session?.access_token;

      const formData = new FormData();
      const fileName = blob ? 'recording.webm' : (uri.split('/').pop() || 'recording.m4a');

      if (blob) {
        formData.append('audio_file', blob, fileName);
      } else {
        formData.append('audio_file', {
          uri,
          type: 'audio/m4a',
          name: fileName,
        } as any);
      }

      formData.append('title', title);
      formData.append(
        'project_tags',
        JSON.stringify(projectTags.split(',').map((t) => t.trim()).filter(Boolean))
      );

      const response = await fetch(`${apiUrl}/api/transcripts/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      Alert.alert('Success', 'Transcript created successfully!');
      setTitle('');
      setProjectTags('');
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload audio');
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <TextInput
          style={styles.input}
          placeholder="Transcript Title"
          value={title}
          onChangeText={setTitle}
        />

        <TextInput
          style={styles.input}
          placeholder="Project Tags (comma separated)"
          value={projectTags}
          onChangeText={setProjectTags}
        />

        <TouchableOpacity
          style={[styles.recordButton, isRecording && styles.recordingButton]}
          onPress={isRecording ? stopRecording : startRecording}
          disabled={uploading}
        >
          <Ionicons
            name={isRecording ? 'stop' : 'mic'}
            size={64}
            color="#fff"
          />
        </TouchableOpacity>

        <Text style={styles.recordText}>
          {isRecording ? 'Tap to stop recording' : 'Tap to start recording'}
        </Text>

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.line} />
        </View>

        <TouchableOpacity
          style={styles.uploadButton}
          onPress={pickAudioFile}
          disabled={uploading}
        >
          <Ionicons name="cloud-upload" size={24} color="#007AFF" />
          <Text style={styles.uploadText}>
            {uploading ? 'Uploading...' : 'Upload Audio File'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
  },
  recordButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 32,
  },
  recordingButton: {
    backgroundColor: '#FF3B30',
  },
  recordText: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginVertical: 24,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#666',
    fontSize: 14,
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  uploadText: {
    marginLeft: 8,
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '600',
  },
});
