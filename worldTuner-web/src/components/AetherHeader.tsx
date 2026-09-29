import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';

interface AetherHeaderProps {
  trailing?: ReactNode;
}

/** 复用安卓端的紧凑品牌栏，地图页可改用悬浮标识。 */
export default function AetherHeader({ trailing }: AetherHeaderProps) {
  return (
    <header className="aether-header">
      <Link href="/player" className="aether-header__brand">
        <Image src="/worldtuner-logo.svg" width={28} height={28} alt="" className="worldtuner-logo" />
        WORLDTUNER
      </Link>
      <span className="aether-header__spacer" />
      {trailing}
    </header>
  );
}
