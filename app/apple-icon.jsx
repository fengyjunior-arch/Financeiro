import { ImageResponse } from 'next/og';
import { Marca } from '../lib/marca';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(<Marca size={180} />, size);
}
