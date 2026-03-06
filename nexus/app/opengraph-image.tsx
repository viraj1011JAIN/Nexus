 
/*
 * Inline `style` props are required throughout this file.
 * satori (the renderer behind ImageResponse) does not support external CSS —
 * every layout property must be passed via the style prop.
 */
import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'NEXUS - Enterprise-Grade Task Management';
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#09090B',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Scaled-up N lettermark */}
        <svg
          width="120"
          height="120"
          viewBox="0 0 32 32"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/*
           * ImageResponse renders SVG via satori which does not support
           * <linearGradient>. We split the path into two segments and
           * colour each half manually: sky (#0EA5E9) for the left stem
           * and violet (#8B5CF6) for the diagonal + right stem.
           */}
          {/* Left vertical stem — sky */}
          <path
            d="M10 22V10"
            stroke="#0EA5E9"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Diagonal + right vertical stem — violet */}
          <path
            d="M10 10L22 22V10"
            stroke="#8B5CF6"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Wordmark */}
        <div
          style={{
            marginTop: 40,
            fontSize: 90,
            fontWeight: 700,
            color: 'white',
            letterSpacing: '8px',
          }}
        >
          NEXUS
        </div>

        {/* Subtitle */}
        <div
          style={{
            marginTop: 20,
            fontSize: 36,
            color: '#A1A1AA',
            letterSpacing: '2px',
            fontWeight: 400,
          }}
        >
          Enterprise-Grade Task Management
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
