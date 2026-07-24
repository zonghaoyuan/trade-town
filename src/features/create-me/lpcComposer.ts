import { CreateMeDraft, getLpcWalkLayers } from '../../../shared/createMe';

export type ComposedLpcSheet = {
  blob: Blob;
  dataUrl: string;
  licenseManifest: string[];
};

const imageCache = new Map<string, Promise<HTMLImageElement>>();

function loadImage(url: string) {
  const cached = imageCache.get(url);
  if (cached) return cached;
  const pending = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`LPC 素材加载失败：${url.split('/spritesheets/')[1]}`));
    image.src = url;
  });
  imageCache.set(url, pending);
  return pending;
}

function hexToRgb(hex: string) {
  const value = Number.parseInt(hex.replace('#', ''), 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function drawTintedLayer(
  target: CanvasRenderingContext2D,
  image: HTMLImageElement,
  tint: string,
) {
  const layer = document.createElement('canvas');
  layer.width = 576;
  layer.height = 256;
  const context = layer.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('浏览器不支持 LPC Canvas 合成');
  context.imageSmoothingEnabled = false;
  context.drawImage(image, 0, 0);

  if (tint !== '#ffffff') {
    const pixels = context.getImageData(0, 0, layer.width, layer.height);
    const color = hexToRgb(tint);
    for (let offset = 0; offset < pixels.data.length; offset += 4) {
      if (pixels.data[offset + 3] === 0) continue;
      pixels.data[offset] = Math.round((pixels.data[offset] * color.r) / 255);
      pixels.data[offset + 1] = Math.round((pixels.data[offset + 1] * color.g) / 255);
      pixels.data[offset + 2] = Math.round((pixels.data[offset + 2] * color.b) / 255);
    }
    context.putImageData(pixels, 0, 0);
  }
  target.drawImage(layer, 0, 0);
}

export async function composeLpcWalkSheet(draft: CreateMeDraft): Promise<ComposedLpcSheet> {
  const layers = getLpcWalkLayers(draft);
  const images = await Promise.all(layers.map((layer) => loadImage(layer.url)));
  const canvas = document.createElement('canvas');
  canvas.width = 576;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('浏览器不支持 LPC Canvas 合成');
  context.imageSmoothingEnabled = false;
  context.clearRect(0, 0, canvas.width, canvas.height);
  layers.forEach((layer, index) => drawTintedLayer(context, images[index], layer.tint));

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => {
      if (result) resolve(result);
      else reject(new Error('无法生成 LPC 行走图'));
    }, 'image/png');
  });
  return {
    blob,
    dataUrl: canvas.toDataURL('image/png'),
    licenseManifest: layers.map((layer) => layer.creditPath),
  };
}
