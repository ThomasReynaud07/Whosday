// GIPHY search. Paste your GIPHY API key below (free: developers.giphy.com).
// It's a public/client key, safe to ship in the app.
export const GIPHY_API_KEY = "j7wOw8uOHosIn9RJWmuovjclsBMjk9AB";

export const GIPHY_READY = GIPHY_API_KEY.length > 0;

// Returns [{ id, preview (small animated .gif for the grid), gif (a .gif URL
// to send - WAHA converts it to a looping WhatsApp GIF) }]. Empty query ->
// trending.
export async function searchGifs(query) {
  if (!GIPHY_READY) return [];
  const q = query.trim();
  const base = q
    ? `https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(q)}&limit=24`
    : `https://api.giphy.com/v1/gifs/trending?limit=24`;
  const url = `${base}&rating=pg&bundle=messaging_non_clips&api_key=${GIPHY_API_KEY}`;
  const res = await fetch(url);
  const json = await res.json();
  return (json.data || [])
    .map((g) => ({
      id: g.id,
      preview: g.images?.fixed_width_small?.url || g.images?.fixed_width?.url,
      // A reasonably-sized .gif for sending (kept small for WhatsApp).
      gif: g.images?.downsized?.url || g.images?.fixed_height?.url || g.images?.original?.url,
    }))
    .filter((g) => g.preview && g.gif);
}
