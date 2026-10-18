import { ImageResponse } from 'next/og';
import { Marca } from '../lib/marca';

export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(<Marca size={512} />, size);
}
