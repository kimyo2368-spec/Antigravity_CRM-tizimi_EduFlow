const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://zctbaqrbvxwbklwlanzj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_tcaiu_pbIloqnnBZm4JHAg_nKg5Lx-5';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function test() {
  console.log('Testing connection...');
  const { data, error } = await supabase.from('students').select('*');
  if (error) {
    console.error('Select Error:', error);
  } else {
    console.log('Select Success! Found records:', data.length);
    
    if (data.length === 0) {
       console.log('Attempting Insert...');
       const { data: insData, error: insErr } = await supabase.from('students').upsert([
         { id: 'test-1', code: 'TEST', fullName: 'Test User' }
       ]);
       if (insErr) {
          console.error('Insert Error:', insErr);
       } else {
          console.log('Insert Success!', insData);
       }
    }
  }
}

test();
