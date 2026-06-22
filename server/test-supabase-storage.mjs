import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucket = process.env.SUPABASE_BUCKET || 'performx-files';

console.log('URL:', url);
console.log('Key prefix:', key?.slice(0, 20), '| length:', key?.length);
console.log('Bucket:', bucket);

const supabase = createClient(url, key);

console.log('\n--- listBuckets ---');
const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
console.log('buckets:', buckets?.map(b => b.name));
console.log('error:', listErr);

console.log('\n--- test upload ---');
const { data, error } = await supabase.storage
  .from(bucket)
  .upload('test/ping.txt', Buffer.from('ping'), { contentType: 'text/plain', upsert: true });
console.log('upload data:', data);
console.log('upload error:', error);