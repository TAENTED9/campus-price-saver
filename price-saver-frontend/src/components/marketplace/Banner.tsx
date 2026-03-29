import Image from "next/image";
import { optimizeImage } from "@/lib/cloudinary";
import BannerText from "./BannerText";

export interface BannerProps {
  imageUrl: string;
  title: string;
  description?: string;
  ctaLabel?: string;
  ctaHref?: string;
  secondaryCtaLabel?: string;
  secondaryCtaHref?: string;
  overlayVariant?: "gradient-left" | "gradient-center" | "dark" | "blur";
  height?: "sm" | "md" | "lg";
  priority?: boolean;
}

const HEIGHT_MAP = {
  sm: "h-[280px]",
  md: "h-[400px]",
  lg: "h-[520px]",
} as const;

const OVERLAY_MAP = {
  "gradient-left":   "absolute inset-0 bg-gradient-to-r from-black/65 via-black/30 to-transparent",
  "gradient-center": "absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent",
  dark:              "absolute inset-0 bg-black/50",
  blur:              "absolute inset-0 backdrop-blur-sm bg-black/30",
} as const;

export default function Banner({
  imageUrl,
  title,
  description,
  ctaLabel,
  ctaHref,
  secondaryCtaLabel,
  secondaryCtaHref,
  overlayVariant = "gradient-center",
  height = "md",
  priority = true,
}: BannerProps) {
  const optimizedUrl = optimizeImage(imageUrl, 1600);
  const heightClass  = HEIGHT_MAP[height];
  const overlayClass = OVERLAY_MAP[overlayVariant];
  const alignLeft    = overlayVariant === "gradient-left";

  return (
    <div className={`relative w-full ${heightClass} overflow-hidden rounded-2xl`}>
      {/* Background image */}
      <Image
        src={optimizedUrl || imageUrl}
        alt={title}
        fill
        sizes="100vw"
        priority={priority}
        className="object-cover object-center"
      />

      {/* Overlay */}
      <div className={overlayClass} />

      {/* Animated text layer */}
      <BannerText
        title={title}
        description={description}
        ctaLabel={ctaLabel}
        ctaHref={ctaHref}
        secondaryCtaLabel={secondaryCtaLabel}
        secondaryCtaHref={secondaryCtaHref}
        alignLeft={alignLeft}
      />
    </div>
  );
}
