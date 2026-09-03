import { youtubeEmbedUrl } from "@/lib/client/youtube";
import { cn } from "@/lib/utils";

export function YoutubeEmbed({ videoId, className }: { videoId: string; className?: string }) {
  return (
    <div className={cn("relative aspect-video w-full overflow-hidden rounded-2xl bg-black", className)}>
      <iframe
        src={youtubeEmbedUrl(videoId)}
        title="Video oynatıcı"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}
