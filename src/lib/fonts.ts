import { EB_Garamond, IM_Fell_English_SC } from 'next/font/google';

// Tipos inspirados nas impressões genebrinas do século XVI (Estienne, Crespin).
export const garamond = EB_Garamond({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--font-garamond',
  display: 'swap',
});

export const fell = IM_Fell_English_SC({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-fell',
  display: 'swap',
});
