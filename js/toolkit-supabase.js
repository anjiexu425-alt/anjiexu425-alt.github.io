import { supabase } from './diary-supabase.js';

const SKILLS_TABLE = 'toolkit_skills';
const PROJECTS_TABLE = 'toolkit_projects';

export async function fetchToolkitSkills() {
  const { data, error } = await supabase
    .from(SKILLS_TABLE)
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function insertToolkitSkill(row) {
  const { data, error } = await supabase
    .from(SKILLS_TABLE)
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteToolkitSkill(id) {
  const { error } = await supabase.from(SKILLS_TABLE).delete().eq('id', id);
  if (error) throw error;
}

export async function fetchToolkitProjects() {
  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data;
}

export async function insertToolkitProject(row) {
  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteToolkitProject(id) {
  const { error } = await supabase.from(PROJECTS_TABLE).delete().eq('id', id);
  if (error) throw error;
}
