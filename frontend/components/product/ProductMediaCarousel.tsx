"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ProductMediaCarouselProps = {
  title: string;
  coverURL?: string | null;
  galleryURLs: string[];
  useTextCover?: boolean;
  videoURL?: string | null;
};

function youtubeEmbedURL(value?: string | null) {
  if (!value) return "";
  try {
    const url = new URL(value);
    const id = url.hostname.includes("youtu.be") ? url.pathname.slice(1) : url.searchParams.get("v") || url.pathname.split("/").filter(Boolean).pop();
    return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : "";
  } catch {
    return "";
  }
}

export function ProductMediaCarousel({ title, coverURL, galleryURLs, useTextCover, videoURL }: ProductMediaCarouselProps) {
  const slides = useMemo(() => {
    const items: Array<{ type: "text" | "image"; url?: string }> = [];
    if (useTextCover) items.push({ type: "text" });
    else if (coverURL) items.push({ type: "image", url: coverURL });
    for (const url of galleryURLs) {
      if (url && !items.some((item) => item.url === url)) items.push({ type: "image", url });
    }
    return items;
  }, [coverURL, galleryURLs, useTextCover]);
  const [index, setIndex] = useState(0);
  const embedURL = youtubeEmbedURL(videoURL);
  const [activeMedia, setActiveMedia] = useState<"carousel" | "video">(slides.length ? "carousel" : "video");
  const hasCarousel = slides.length > 0;
  const hasVideo = Boolean(embedURL);

  useEffect(() => {
    if (activeMedia !== "carousel" || slides.length < 2) return;
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % slides.length), 6000);
    return () => window.clearInterval(timer);
  }, [activeMedia, slides.length]);

  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [index, slides.length]);

  useEffect(() => {
    if (!hasCarousel && hasVideo) setActiveMedia("video");
    if (hasCarousel && !hasVideo) setActiveMedia("carousel");
  }, [hasCarousel, hasVideo]);

  if (!hasCarousel && !hasVideo) return null;

  return (
    <div className="mb-6">
      {hasCarousel && hasVideo ? (
        <div className="flex border-b border-border" role="tablist" aria-label="Product media">
          <button
            id="tab-carousel"
            type="button"
            role="tab"
            aria-selected={activeMedia === "carousel"}
            aria-controls="carouselPane"
            onClick={() => setActiveMedia("carousel")}
            className={`border-b-2 px-4 py-2.5 text-sm transition ${activeMedia === "carousel" ? "border-primary text-textPrimary" : "border-transparent text-textSecondary hover:text-textPrimary"}`}
          >
            Carousel
          </button>
          <button
            id="tab-videoDemo"
            type="button"
            role="tab"
            aria-selected={activeMedia === "video"}
            aria-controls="videoPane"
            onClick={() => setActiveMedia("video")}
            className={`border-b-2 px-4 py-2.5 text-sm transition ${activeMedia === "video" ? "border-primary text-textPrimary" : "border-transparent text-textSecondary hover:text-textPrimary"}`}
          >
            Demo video
          </button>
        </div>
      ) : null}

      {hasCarousel && activeMedia === "carousel" ? (
        <div className="relative overflow-hidden rounded-md border border-border bg-background">
          <div id="carouselPane" role="tabpanel" aria-labelledby={hasVideo ? "tab-carousel" : undefined} className="aspect-[2/1]">
            {slides[index]?.type === "text" ? (
              <div className="flex size-full items-center justify-center bg-[var(--bg-panel)] px-8 text-center">
                <span className="text-balance text-3xl font-semibold text-textPrimary sm:text-4xl">{title}</span>
              </div>
            ) : (
              <img src={slides[index]?.url} alt={`${title} preview ${index + 1}`} decoding="async" fetchPriority={index === 0 ? "high" : "auto"} className="size-full object-cover" />
            )}
          </div>
          {slides.length > 1 ? (
            <>
              <button type="button" title="Previous image" onClick={() => setIndex((current) => (current - 1 + slides.length) % slides.length)} className="absolute left-3 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md bg-black/70 text-textPrimary"><ChevronLeft className="size-5" /></button>
              <button type="button" title="Next image" onClick={() => setIndex((current) => (current + 1) % slides.length)} className="absolute right-3 top-1/2 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-md bg-black/70 text-textPrimary"><ChevronRight className="size-5" /></button>
              <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-md bg-black/60 px-2 py-1.5">
                {slides.map((_, slideIndex) => <button key={slideIndex} type="button" aria-label={`Show image ${slideIndex + 1}`} onClick={() => setIndex(slideIndex)} className={`size-1.5 rounded-full ${slideIndex === index ? "bg-white" : "bg-white/40"}`} />)}
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {hasVideo && activeMedia === "video" ? (
        <div id="videoPane" role="tabpanel" aria-labelledby={hasCarousel ? "tab-videoDemo" : undefined} className="overflow-hidden rounded-md border border-border bg-black">
          <iframe src={embedURL} title={`${title} video demo`} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="aspect-video w-full" />
        </div>
      ) : null}
    </div>
  );
}
