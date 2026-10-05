import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import transcriptRoutes from './routes/transcripts';
import userRoutes from './routes/users';
import apiKeyRoutes from './routes/apiKeys';
import { errorHandler } from './middleware/errorHandler';
import { setupUploadDirectory } from './utils/storage';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Setup upload directory
setupUploadDirectory();

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/transcripts', transcriptRoutes);
app.use('/api/user', userRoutes);
app.use('/api/keys', apiKeyRoutes);

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 Backend server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
});
