export const CONFIG = {
  SUPABASE_URL: "https://idazoapvuefxkulratej.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_yXTybJFaIi6HlUXt1DGtfw_8iaMg4nK",
  APP_NAME: "I prodotti notevoli",
  POLL_MS: 5000
};

export function configured(){
  return !CONFIG.SUPABASE_URL.includes('YOUR_PROJECT') && !CONFIG.SUPABASE_ANON_KEY.includes('YOUR_PUBLIC');
}
