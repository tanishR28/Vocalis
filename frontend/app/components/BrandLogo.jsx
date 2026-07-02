import Image from 'next/image';
import Link from 'next/link';
import { cn } from '@/lib/utils';

export const BRAND_ASSETS = {
  icon: '/logo.png',
  iconBordered: '/logo_bordered.png',
  wordmark: '/logo_text.png',
  onboardingBg: '/onBoarding_bg.png',
};

/** Text wordmark without the stylized “tick” inside the A (sidebar use). */
export function BrandWordmarkText({ className }) {
  return (
    <span
      className={cn(
        'font-headline text-[1.05rem] font-extrabold tracking-[0.06em] text-slate-900 leading-none whitespace-nowrap',
        className,
      )}
    >
      VOC
      <span className="text-primary">A</span>
      LIS
    </span>
  );
}

/** Bordered icon + wordmark; collapsed shows bordered icon only. */
export function SidebarBrandLockup({ collapsed = false, href = '/', priority = false, className }) {
  const icon = (
    <Image
      src={BRAND_ASSETS.iconBordered}
      alt=""
      width={36}
      height={36}
      priority={priority}
      aria-hidden
      className="h-9 w-9 shrink-0 object-contain"
    />
  );

  if (collapsed) {
    return (
      <Link
        href={href}
        className={cn('inline-flex items-center justify-center', className)}
        aria-label="Vocalis home"
      >
        {icon}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn('inline-flex min-w-0 items-center gap-2.5', className)}
      aria-label="Vocalis home"
    >
      {icon}
      <BrandWordmarkText />
    </Link>
  );
}

/**
 * @param {'icon' | 'iconBordered' | 'wordmark'} variant
 * @param {string} [href] — wrap in a link when set
 */
export default function BrandLogo({
  variant = 'icon',
  className,
  imageClassName,
  priority = false,
  href,
  hideTagline = false,
}) {
  const isWordmark = variant === 'wordmark';
  const src =
    variant === 'wordmark'
      ? BRAND_ASSETS.wordmark
      : variant === 'iconBordered'
        ? BRAND_ASSETS.iconBordered
        : BRAND_ASSETS.icon;

  const image = isWordmark && hideTagline ? (
    <div className={cn('h-10 overflow-hidden', imageClassName)}>
      <Image
        src={src}
        alt="Vocalis"
        width={220}
        height={64}
        priority={priority}
        className="h-[46px] w-auto max-w-[220px] object-cover object-left object-top"
      />
    </div>
  ) : (
    <Image
      src={src}
      alt="Vocalis"
      width={isWordmark ? 220 : 80}
      height={isWordmark ? 64 : 80}
      priority={priority}
      className={cn(
        isWordmark ? 'h-10 w-auto max-w-[200px] object-contain object-left' : 'h-10 w-10 object-contain',
        imageClassName,
      )}
    />
  );

  const content = href ? (
    <Link href={href} className={cn('inline-flex shrink-0 items-center', className)} aria-label="Vocalis home">
      {image}
    </Link>
  ) : (
    <span className={cn('inline-flex shrink-0 items-center', className)}>{image}</span>
  );

  return content;
}
