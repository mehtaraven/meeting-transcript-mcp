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
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState('');
  const [jobId, setJobId] = useState<string | null>(null);
  const { session } = useAuth();

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const xhrRef = useRef<XMLHttpRequest | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const cancelledRef = useRef(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isWeb = Platform.OS === 'web';

  const cancelUpload = () => {
    cancelledRef.current = true;
    xhrRef.current?.abort();
    abortControllerRef.current?.abort();
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    setUploading(false);
    setUploadProgress(0);
    setUploadStage('');
    setJobId(null);
    Alert.alert('Cancelled', 'Upload cancelled.');
  };

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

    cancelledRef.current = false;
    setUploading(true);
    try {
      const apiUrl = process.env.EXPO_PUBLIC_API_URL;
      const token = session?.access_token;
      const tags = JSON.stringify(
        projectTags.split(',').map((t) => t.trim()).filter(Boolean)
      );

      if (blob) {
        const controller = new AbortController();
        abortControllerRef.current = controller;
        const formData = new FormData();
        formData.append('audio_file', blob, 'recording.webm');
        formData.append('title', title);
        formData.append('project_tags', tags);

        const response = await fetch(`${apiUrl}/api/transcripts/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Upload failed');

        const data = await response.json();
        const receivedJobId: string = data.jobId;
        if (receivedJobId) {
          setJobId(receivedJobId);
          const interval = setInterval(async () => {
            try {
              const pollRes = await fetch(`${apiUrl}/api/transcripts/job/${receivedJobId}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              const pollData = await pollRes.json();
              setUploadProgress(pollData.progress ?? 0);
              setUploadStage(pollData.message ?? '');
              if (pollData.status === 'completed') {
                clearInterval(interval);
                pollIntervalRef.current = null;
                setUploading(false);
                setJobId(null);
                setUploadProgress(0);
                setUploadStage('');
                Alert.alert('Success', 'Transcript created successfully!');
                setTitle('');
                setProjectTags('');
              } else if (pollData.status === 'failed') {
                clearInterval(interval);
                pollIntervalRef.current = null;
                setUploading(false);
                setJobId(null);
                setUploadProgress(0);
                setUploadStage('');
                Alert.alert('Error', pollData.error || 'Transcription failed');
              }
            } catch (_e) { /* ignore poll blips */ }
          }, 1500);
          pollIntervalRef.current = interval;
          return; // stay in uploading state; poll handler will dismiss
        } else {
          // Server responded 2xx but without a jobId — show success anyway
          Alert.alert('Success', 'Transcript created successfully!');
          setTitle('');
          setProjectTags('');
        }
      } else {
        await new Promise<void>((resolve, reject) => {
          const formData = new FormData();
          const fileName = uri.split('/').pop() || 'recording.m4a';
          const ext = fileName.split('.').pop()?.toLowerCase();
          const mimeMap: Record<string, string> = {
            m4a: 'audio/m4a',
            mp3: 'audio/mpeg',
            wav: 'audio/wav',
            mp4: 'audio/mp4',
            webm: 'audio/webm',
            ogg: 'audio/ogg',
            aac: 'audio/aac',
          };
          const mimeType = (ext && mimeMap[ext]) || 'audio/m4a';
          (formData as any).append('audio_file', { uri, type: mimeType, name: fileName });
          formData.append('title', title);
          formData.append('project_tags', tags);

          const xhr = new XMLHttpRequest();
          xhrRef.current = xhr;
          xhr.open('POST', `${apiUrl}/api/transcripts/upload`);
          xhr.setRequestHeader('Authorization', `Bearer ${token}`);
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const data = JSON.parse(xhr.responseText);
                if (data.jobId) {
                  setJobId(data.jobId);
                  const receivedJobId = data.jobId;
                  const interval = setInterval(async () => {
                    try {
                      const pollRes = await fetch(`${apiUrl}/api/transcripts/job/${receivedJobId}`, {
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      const pollData = await pollRes.json();
                      setUploadProgress(pollData.progress ?? 0);
                      setUploadStage(pollData.message ?? '');
                      if (pollData.status === 'completed') {
                        clearInterval(interval);
                        pollIntervalRef.current = null;
                        setUploading(false);
                        setJobId(null);
                        setUploadProgress(0);
                        setUploadStage('');
                        Alert.alert('Success', 'Transcript created successfully!');
                        setTitle('');
                        setProjectTags('');
                      } else if (pollData.status === 'failed') {
                        clearInterval(interval);
                        pollIntervalRef.current = null;
                        setUploading(false);
                        setJobId(null);
                        setUploadProgress(0);
                        setUploadStage('');
                        Alert.alert('Error', pollData.error || 'Transcription failed');
                      }
                    } catch (_e) { /* ignore poll blips */ }
                  }, 1500);
                  pollIntervalRef.current = interval;
                } else {
                  // Server responded 2xx but without a jobId — show success anyway
                  Alert.alert('Success', 'Transcript created successfully!');
                  setTitle('');
                  setProjectTags('');
                }
              } catch (_e) { /* JSON parse failed, continue */ }
              resolve();
            } else {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          };
          xhr.onerror = () => reject(new Error('Network error'));
          xhr.onabort = () => reject(new Error('cancelled'));
          xhr.send(formData);
        });
      }

      if (cancelledRef.current) return;
    } catch (error: any) {
      if (cancelledRef.current || error?.name === 'AbortError' || error?.message === 'cancelled') return;
      console.error('Upload error:', error);
      Alert.alert('Error', 'Failed to upload audio');
    } finally {
      xhrRef.current = null;
      abortControllerRef.current = null;
      // Only clear uploading here if we are NOT waiting for a job poll
      // (poll completion handler clears it when status=completed/failed)
      if (!pollIntervalRef.current) {
        setUploading(false);
      }
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

        {uploading && (
          <View style={styles.progressContainer}>
            <Text style={styles.progressStage}>{uploadStage || 'Uploading...'}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${uploadProgress}%` as any }]} />
            </View>
            <Text style={styles.progressPercent}>{uploadProgress}%</Text>
            <TouchableOpacity style={styles.cancelButton} onPress={cancelUpload}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        )}
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
  progressContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    width: '100%',
  },
  progressTrack: {
    height: 8,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
    width: '100%',
    marginVertical: 12,
    overflow: 'hidden',
  },
  progressFill: {
    height: 8,
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  progressStage: {
    fontSize: 16,
    color: '#1e293b',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  progressPercent: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#FF3B30',
  },
  cancelText: {
    color: '#FF3B30',
    fontWeight: '600',
    fontSize: 15,
  },
});
