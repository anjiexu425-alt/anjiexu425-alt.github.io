import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// From your Supabase project's Settings -> API (see Prerequisites, Step 5).
// The anon/public key is safe to ship in client code — Supabase's access
// control is enforced by the diary_entries/storage.objects Row Level
// Security policies (see Prerequisites, Steps 2-3), not by keeping this
// key secret.
const SUPABASE_URL = 'https://qwjiatwxrsqkgqolytdj.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3amlhdHd4cnNxa2dxb2x5dGRqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NjQ5MDcsImV4cCI6MjEwMDI0MDkwN30.RL3hfcYZJt9S-0XOJ_nwqUAsCIyqJ2lap9cX9U_PtUo';

const MEDIA_BUCKET = 'diary-media';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export async function fetchEntries() {
  const { data, error } = await supabase
    .from('diary_entries')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function insertEntry(row) {
  const { data, error } = await supabase
    .from('diary_entries')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEntry(id) {
  const { error } = await supabase.from('diary_entries').delete().eq('id', id);
  if (error) throw error;
}

export async function updateEntry(id, patch) {
  const { data, error } = await supabase
    .from('diary_entries')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function uploadFile(file, path) {
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.session;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export function onAuthStateChange(callback) {
  supabase.auth.onAuthStateChange((_event, session) => callback(session));
}
