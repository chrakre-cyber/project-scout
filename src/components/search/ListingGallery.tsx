import type { ListingMedia } from "@/server/demo-media";

/** Enkelt galleri: første bilde stort, resten som rutenett (ingen skript). Bildene er lokale demo-assets og merkes alltid som demo. */
export function ListingGallery({ media }: { media: ListingMedia }) {
  const [first, ...rest] = media.images;
  if (!first) return null;
  return (
    <section aria-label="Bildegalleri (demo)" data-testid="gallery" data-origin={media.origin} className="space-y-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={first.src} alt={first.alt} className="w-full rounded-2xl border border-sand object-cover" data-testid="gallery-main" />
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="gallery-thumbs">
        {rest.map((im) => (
          // eslint-disable-next-line @next/next/no-img-element
          <li key={im.src}><a href={im.src} target="_blank" rel="noopener"><img src={im.src} alt={im.alt} loading="lazy" className="aspect-[4/3] w-full rounded-lg border border-sand object-cover" /></a></li>
        ))}
      </ul>
      <p className="text-xs text-muted" data-testid="gallery-note">Demobilder lagret lokalt i Merovo-demoen. Ikke hentet fra mobile.de eller noen annen leverandør.</p>
    </section>
  );
}
