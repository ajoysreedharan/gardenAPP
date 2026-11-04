import { useEffect, useMemo } from 'preact/hooks';
import type { Problem } from '../domain/types';

export function ProblemPhoto({ problem }: { problem: Problem }) {
  const url = useMemo(() => (problem.photo ? URL.createObjectURL(problem.photo) : null), [problem.photo]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  if (!url) return null;
  return <img class="thumb" src={url} alt={`Photo: ${problem.spotId} ${problem.text}`} />;
}

const MAX_SIDE = 1280;

// Shrinks a camera photo so it doesn't bloat storage and backups. Falls back to the original.
export async function downscalePhoto(file: Blob): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.8));
    return out ?? file;
  } catch {
    return file;
  }
}
