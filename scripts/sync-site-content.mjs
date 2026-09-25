import { readFile, writeFile } from 'node:fs/promises';

const allowedKeys = new Set([
  'admin_1_name', 'admin_1_role', 'admin_1_skin',
  'admin_2_name', 'admin_2_role', 'admin_2_skin',
  'admin_3_name', 'admin_3_role', 'admin_3_skin',
  'discord_url', 'facebook_url', 'footer_year', 'hero_image_url',
  'hero_subtitle', 'hero_title', 'logo_url', 'server_ip', 'shop_url', 'youtube_url'
]);

const previous = JSON.parse(await readFile('site-content.json', 'utf8'));
const endpoint = new URL('/rest/v1/site_content?select=key,value&order=key', process.env.SUPABASE_URL);
const response = await fetch(endpoint, {
  headers: {
    apikey: process.env.SUPABASE_PUBLISHABLE_KEY,
    authorization: `Bearer ${process.env.SUPABASE_PUBLISHABLE_KEY}`
  }
});

if (!response.ok) throw new Error(`Supabase read failed (${response.status}).`);

const rows = await response.json();
const content = { ...previous };
for (const row of rows) {
  if (allowedKeys.has(row.key) && typeof row.value === 'string') content[row.key] = row.value;
}

await writeFile('site-content.json', `${JSON.stringify(content, null, 2)}\n`);
