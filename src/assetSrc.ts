/** Next.js image imports expose `.src`; esbuild/webpack dataurl loaders return a string. */
export function assetSrc(asset: string | { src?: string; default?: string }): string {
  if (typeof asset === 'string') return asset;
  return asset?.src || asset?.default || '';
}
