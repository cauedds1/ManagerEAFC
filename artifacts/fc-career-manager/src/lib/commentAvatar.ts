const PALETTE: [string, string][] = [
  ["#f87171", "#be123c"],
  ["#fb923c", "#c2410c"],
  ["#fbbf24", "#b45309"],
  ["#a3e635", "#4d7c0f"],
  ["#34d399", "#065f46"],
  ["#2dd4bf", "#0f766e"],
  ["#38bdf8", "#0369a1"],
  ["#818cf8", "#3730a3"],
  ["#c084fc", "#7e22ce"],
  ["#f472b6", "#9d174d"],
  ["#fb7185", "#9f1239"],
  ["#67e8f9", "#155e75"],
  ["#86efac", "#166534"],
  ["#fdba74", "#9a3412"],
];

function usernameHash(username: string): number {
  let h = 0;
  for (let i = 0; i < username.length; i++) {
    h = (h * 31 + username.charCodeAt(i)) & 0x7fffffff;
  }
  return h;
}

export function getCommentAvatarUrl(username: string): string {
  const idx = usernameHash(username) % PALETTE.length;
  const [light, dark] = PALETTE[idx];

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" width="40" height="40">
  <defs>
    <radialGradient id="bg" cx="50%" cy="35%" r="65%">
      <stop offset="0%" stop-color="${light}"/>
      <stop offset="100%" stop-color="${dark}"/>
    </radialGradient>
  </defs>
  <circle cx="20" cy="20" r="20" fill="url(#bg)"/>
  <circle cx="20" cy="15" r="7.5" fill="rgba(255,255,255,0.88)"/>
  <ellipse cx="20" cy="35" rx="13.5" ry="9.5" fill="rgba(255,255,255,0.88)"/>
</svg>`;

  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
