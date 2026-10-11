import { createClient } from "@supabase/supabase-js";

const [playerId, phone] = process.argv.slice(2);
if (!playerId || !/^\+[1-9][0-9]{7,14}$/.test(phone ?? "")) {
  console.error("Usage: npm run contact:add -- <player_id> <+15551234567>");
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) {
  console.error("Set SUPABASE_URL and SUPABASE_SECRET_KEY in backend/.env.local.");
  process.exit(1);
}

const supabase = createClient(url, secretKey, { auth: { persistSession: false } });
const { error } = await supabase
  .from("player_contacts")
  .upsert({ player_id: playerId, phone, texts_opt_in: true, updated_at: new Date().toISOString() }, { onConflict: "player_id" });

if (error) {
  console.error(error.message);
  process.exit(1);
}
console.log(`${playerId} will get texts at ${phone}.`);
