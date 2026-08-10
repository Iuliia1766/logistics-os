import { ImageResponse } from 'next/og';
import { P } from '@/components/Icons';

const SIZE = 512;

// Full-bleed, glyph kept inside the center safe zone, so this same file can
// serve both the "any" and "maskable" entries in manifest.ts.
export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center', background: '#1d4ed8',
        }}
      >
        <svg width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="#fff"
          strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
          <path d={P.radio} />
        </svg>
      </div>
    ),
    { width: SIZE, height: SIZE },
  );
}
