'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, Expand, X, Images } from 'lucide-react';

interface VillaGalleryProps {
  villaName: string;
  images: string[];
}

export default function VillaGallery({ villaName, images }: VillaGalleryProps) {
  const validImages = images.length > 0 ? images : ['/room images/joy-villa.jpg'];
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const prevSlide = () => {
    setActiveIndex((prev) => (prev === 0 ? validImages.length - 1 : prev - 1));
  };

  const nextSlide = () => {
    setActiveIndex((prev) => (prev === validImages.length - 1 ? 0 : prev + 1));
  };

  return (
    <div className="space-y-4">
      {/* Desktop Modern Bento Grid (1 Large Hero + Up to 4 Side Tiles) */}
      <div>
        {validImages.length === 1 ? (
          <div
            onClick={() => setLightboxOpen(true)}
            className="relative h-72 sm:h-[440px] w-full rounded-2xl overflow-hidden cursor-pointer group"
          >
            <Image
              src={validImages[0]}
              alt={villaName}
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 1152px"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 h-[340px] sm:h-[440px]">
            {/* Primary Active Image */}
            <div
              onClick={() => setLightboxOpen(true)}
              className="md:col-span-7 relative h-full w-full rounded-2xl overflow-hidden cursor-pointer group"
            >
              <Image
                src={validImages[activeIndex]}
                alt={`${villaName} — Photo ${activeIndex + 1}`}
                fill
                priority
                sizes="(max-width: 768px) 100vw, 680px"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />

              {/* Carousel Controls */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  prevSlide();
                }}
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-slate-900/65 hover:bg-slate-900/85 text-white p-2 rounded-full backdrop-blur-sm transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  nextSlide();
                }}
                aria-label="Next photo"
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-900/65 hover:bg-slate-900/85 text-white p-2 rounded-full backdrop-blur-sm transition"
              >
                <ChevronRight className="w-5 h-5" />
              </button>

              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                <span className="text-xs font-bold bg-slate-900/70 backdrop-blur-md px-3 py-1.5 rounded-xl">
                  Photo {activeIndex + 1} of {validImages.length}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setLightboxOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold bg-slate-900/70 hover:bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl transition"
                >
                  <Expand className="w-3.5 h-3.5" /> View Full Gallery
                </button>
              </div>
            </div>

            {/* Bento Thumbnail Grid */}
            <div className="hidden md:grid md:col-span-5 grid-cols-2 grid-rows-2 gap-3 h-full">
              {validImages.slice(0, 4).map((imgUrl, idx) => {
                const isLastTile = idx === 3 && validImages.length > 4;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setActiveIndex(idx);
                      if (isLastTile) setLightboxOpen(true);
                    }}
                    className={`relative h-full w-full rounded-2xl overflow-hidden group border-2 transition-all ${
                      activeIndex === idx
                        ? 'border-emerald-500 ring-2 ring-emerald-500/30'
                        : 'border-transparent opacity-90 hover:opacity-100'
                    }`}
                  >
                    <Image
                      src={imgUrl}
                      alt={`${villaName} thumbnail ${idx + 1}`}
                      fill
                      sizes="260px"
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    {isLastTile && (
                      <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[2px] flex flex-col items-center justify-center text-white">
                        <Images className="w-6 h-6 mb-1 text-emerald-400" />
                        <span className="text-sm font-extrabold">+{validImages.length - 4} More</span>
                        <span className="text-xs uppercase tracking-wider text-slate-300">
                          All Photos
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Filmstrip Thumbnails for Quick Selection */}
        {validImages.length > 1 && (
          <div className="md:hidden flex gap-2 overflow-x-auto pt-3 pb-1">
            {validImages.map((imgUrl, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveIndex(idx)}
                aria-label={`Show photo ${idx + 1}`}
                className={`relative h-14 w-20 rounded-md overflow-hidden shrink-0 transition-all ${
                  activeIndex === idx
                    ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-white dark:ring-offset-[#0a0e15]'
                    : 'opacity-60 hover:opacity-100'
                }`}
              >
                <Image
                  src={imgUrl}
                  alt={`${villaName} preview ${idx + 1}`}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <div
            className="relative max-w-5xl w-full flex flex-col items-center gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between text-white px-2">
              <div>
                <h3 className="text-base font-extrabold">{villaName}</h3>
                <p className="text-xs text-slate-300">
                  Photo {activeIndex + 1} of {validImages.length}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="bg-white/15 hover:bg-white/25 text-white p-2 rounded-full transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative w-full h-[65vh] rounded-2xl overflow-hidden bg-slate-900">
              <Image
                src={validImages[activeIndex]}
                alt={`${villaName} full photo ${activeIndex + 1}`}
                fill
                sizes="100vw"
                className="object-contain"
              />
              {validImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={prevSlide}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/15 hover:bg-white/30 text-white p-3 rounded-full backdrop-blur-md transition"
                  >
                    <ChevronLeft className="w-6 h-6" />
                  </button>
                  <button
                    type="button"
                    onClick={nextSlide}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/15 hover:bg-white/30 text-white p-3 rounded-full backdrop-blur-md transition"
                  >
                    <ChevronRight className="w-6 h-6" />
                  </button>
                </>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto max-w-full py-2">
              {validImages.map((imgUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`relative h-14 w-20 rounded-xl overflow-hidden shrink-0 border-2 transition ${
                    activeIndex === idx ? 'border-emerald-400 scale-105' : 'border-transparent opacity-50'
                  }`}
                >
                  <Image src={imgUrl} alt="" fill sizes="80px" className="object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

