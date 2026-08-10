import { ImageResponse } from 'next/og';
import { P } from '@/components/Icons';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// iOS applies its own corner rounding and dislikes transparency, so this
// stays a plain opaque square — no border-radius, unlike the in-app mark.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center', background: '#1d4ed8',
        }}
      >
        <svg width="108" height="108" viewBox="0 0 24 24" fill="none" stroke="#fff"
          strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
          <path d={P.radio} />
        </svg>
      </div>
    ),
    { ...size },
  );
}
