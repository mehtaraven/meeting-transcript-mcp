import { supabase } from '../config/supabase.js';
import { Profile } from '@meeting-transcript/shared';

export async function getUserProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase.auth.admin.getUserById(userId);

  if (error || !data.user) {
    const err: any = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  return {
    id: data.user.id,
    email: data.user.email!,
    display_name: data.user.user_metadata?.display_name ?? undefined,
    avatar_url: data.user.user_metadata?.avatar_url ?? undefined,
    created_at: data.user.created_at,
    updated_at: data.user.updated_at ?? data.user.created_at,
  };
}
