import { ImageResponse } from 'next/og';
import { P } from '@/components/Icons';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex',
          alignItems: 'center', justifyContent: 'center', background: '#1d4ed8',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff"
          strokeWidth={2.1} strokeLinecap="round" strokeLinejoin="round">
          <path d={P.radio} />
        </svg>
      </div>
    ),
    { ...size },
  );
}
