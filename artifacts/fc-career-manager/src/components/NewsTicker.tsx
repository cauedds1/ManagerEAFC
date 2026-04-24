import { useRef } from "react";
import type { NewsPost } from "@/types/noticias";
import type { PortalPhotos } from "@/lib/portalPhotosStorage";
import { PORTAL_DEFAULT_PHOTOS } from "@/lib/portalPhotosStorage";
import type { Lang } from "@/lib/i18n";
import { PAINEL } from "@/lib/i18n";

interface NewsTickerProps {
  posts: NewsPost[];
  portalPhotos: PortalPhotos;
  customPortalPhotos?: Record<string, string>;
  onClickPost: (postId: string) => void;
  lang: Lang;
  clubLogoUrl?: string | null;
}

function PortalLogo({
  post,
  portalPhotos,
  customPortalPhotos,
  clubLogoUrl,
}: {
  post: NewsPost;
  portalPhotos: PortalPhotos;
  customPortalPhotos?: Record<string, string>;
  clubLogoUrl?: string | null;
}) {
  const [failed, setFailed] = useState(false);

  let photoUrl: string | undefined;
  if (post.source === "custom" && post.customPortalId) {
    photoUrl = customPortalPhotos?.[post.customPortalId] ?? post.sourcePhotoUrl;
  } else if (post.source === "fanpage") {
    photoUrl =
      portalPhotos.fanpage ??
      (clubLogoUrl || undefined) ??
      PORTAL_DEFAULT_PHOTOS.fanpage;
  } else if (post.source !== "custom") {
    photoUrl =
      portalPhotos[post.source] ??
      PORTAL_DEFAULT_PHOTOS[post.source as keyof typeof PORTAL_DEFAULT_PHOTOS];
  }

  if (!photoUrl || failed) {
    const initials = post.sourceName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");
    return (
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: "50%",
          flexShrink: 0,
          background: "rgba(255,255,255,0.1)",
          border: "1px solid rgba(255,255,255,0.15)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 8,
          fontWeight: 900,
          color: "rgba(255,255,255,0.6)",
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <img
      src={photoUrl}
      alt={post.sourceName}
      width={20}
      height={20}
      style={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        objectFit: "cover",
        flexShrink: 0,
        border: "1px solid rgba(255,255,255,0.1)",
      }}
      onError={() => setFailed(true)}
    />
  );
}

export function NewsTicker({
  posts,
  portalPhotos,
  customPortalPhotos,
  onClickPost,
  lang,
  clubLogoUrl,
}: NewsTickerProps) {
  const t = PAINEL[lang];
  const containerRef = useRef<HTMLDivElement>(null);

  if (!posts || posts.length === 0) return null;

  const displayPosts = posts.filter((p) => p.title || p.content);
  if (displayPosts.length === 0) return null;

  const items = [...displayPosts, ...displayPosts];

  const speed = Math.max(40, displayPosts.length * 18);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "stretch",
        borderRadius: 12,
        overflow: "hidden",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        height: 38,
        userSelect: "none",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          paddingLeft: 12,
          paddingRight: 12,
          background: "rgba(var(--club-primary-rgb),0.15)",
          borderRight: "1px solid rgba(var(--club-primary-rgb),0.2)",
          whiteSpace: "nowrap",
          fontSize: 10,
          fontWeight: 800,
          letterSpacing: "0.08em",
          color: "var(--club-primary)",
        }}
      >
        {t.tickerLabel}
      </div>

      <div
        ref={containerRef}
        style={{
          flex: 1,
          overflow: "hidden",
          position: "relative",
          display: "flex",
          alignItems: "center",
        }}
      >
        <style>{`
          @keyframes fc-ticker-scroll {
            0% { transform: translateX(0); }
            100% { transform: translateX(-50%); }
          }
          .fc-ticker-track {
            display: flex;
            align-items: center;
            animation: fc-ticker-scroll ${speed}s linear infinite;
            width: max-content;
          }
        `}</style>

        <div className="fc-ticker-track">
          {items.map((post, idx) => {
            const title = post.title || post.content.slice(0, 80);
            return (
              <button
                key={`${post.id}-${idx}`}
                onClick={() => onClickPost(post.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  paddingLeft: 14,
                  paddingRight: 14,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                <PortalLogo
                  post={post}
                  portalPhotos={portalPhotos}
                  customPortalPhotos={customPortalPhotos}
                  clubLogoUrl={clubLogoUrl}
                />
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "rgba(255,255,255,0.75)",
                    maxWidth: 320,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {title}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: "rgba(255,255,255,0.2)",
                    marginLeft: 6,
                    flexShrink: 0,
                  }}
                >
                  ◆
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
