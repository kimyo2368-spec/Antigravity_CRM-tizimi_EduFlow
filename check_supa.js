const url = "https://zctbaqrbvxwbklwlanzj.supabase.co/rest/v1/students?select=*";
const key = "sb_publishable_tcaiu_pbIloqnnBZm4JHAg_nKg5Lx-5";

async function test() {
  console.log('Fetching students from Supabase...');
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json'
      }
    });
    
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Body:', text);
    
    if (res.status === 200) {
      console.log('Attempting to insert a test record...');
      const postRes = await fetch("https://zctbaqrbvxwbklwlanzj.supabase.co/rest/v1/students", {
        method: 'POST',
        headers: {
          'apikey': key,
          'Authorization': 'Bearer ' + key,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify({
          id: 'test-1',
          code: 'TEST-01',
          fullName: 'Test User'
        })
      });
      console.log('POST Status:', postRes.status);
      console.log('POST Body:', await postRes.text());
    }
  } catch (err) {
    console.error('Network Error:', err);
  }
}

test();
