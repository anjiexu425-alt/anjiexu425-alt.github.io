import { supabase } from './diary-supabase.js';

const TABLE = 'share_life_notes';
const BUCKET = 'share-life-media';

export async function fetchShareLifeNotes() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function insertShareLifeNote(row) {
  const { data, error } = await supabase
    .from(TABLE)
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateShareLifeNote(id, patch) {
  const { data, error } = await supabase
    .from(TABLE)
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteShareLifeNote(id) {
  const { data, error } = await supabase
    .from(TABLE)
    .delete()
    .eq('id', id)
    .select('id')
    .single();
  if (error) throw error;
  if (data?.id !== id) throw new Error('The deleted Share Life note did not match the request.');
}

export async function adjustShareLifeLike(noteId, delta) {
  const { data, error } = await supabase.rpc('adjust_share_life_like', {
    note_id: noteId,
    delta,
  });
  if (error) throw error;
  return Number(data);
}

export async function uploadShareLifeCover(file, path) {
  const storage = supabase.storage.from(BUCKET);
  const { error } = await storage.upload(path, file);
  if (error) throw error;
  const { data } = storage.getPublicUrl(path);
  return { coverUrl: data.publicUrl, coverPath: path };
}

export async function removeShareLifeCover(path) {
  if (!path) return;
  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw error;
}
