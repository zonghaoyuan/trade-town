// Based on https://codepen.io/inlet/pen/yLVmPWv.
// Copyright (c) 2018 Patrick Brouwer, distributed under the MIT license.

import { PixiComponent } from '@pixi/react';
import { Viewport } from 'pixi-viewport';
import { Application } from 'pixi.js';
import { MutableRefObject, ReactNode } from 'react';
import { getMapContainScale } from './viewportFit';

export type ViewportProps = {
  app: Application;
  viewportRef?: MutableRefObject<Viewport | undefined>;

  screenWidth: number;
  screenHeight: number;
  worldWidth: number;
  worldHeight: number;
  children?: ReactNode;
};

function fitViewportToFrame(viewport: Viewport, props: ViewportProps) {
  viewport.resize(props.screenWidth, props.screenHeight, props.worldWidth, props.worldHeight);

  // The same Pixi world stays mounted when switching between the market and full-town
  // layouts. Re-fit the camera when its frame changes and use a contain scale so every
  // edge of the map remains visible when a data panel narrows the available frame.
  const containScale = getMapContainScale(
    props.screenWidth,
    props.screenHeight,
    props.worldWidth,
    props.worldHeight,
  );
  viewport.setZoom(containScale, true);
  viewport
    .clamp({ direction: 'all', underflow: 'center' })
    .clampZoom({ minScale: containScale, maxScale: Math.max(3, containScale) });
}

function hasMeasuredFrame(props: ViewportProps) {
  return (
    props.screenWidth > 0 &&
    props.screenHeight > 0 &&
    props.worldWidth > 0 &&
    props.worldHeight > 0
  );
}

// https://davidfig.github.io/pixi-viewport/jsdoc/Viewport.html
export default PixiComponent('Viewport', {
  create(props: ViewportProps) {
    const { app, children: _children, viewportRef, ...viewportProps } = props;
    const viewport = new Viewport({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      events: app.renderer.events,
      passiveWheel: false,
      ...viewportProps,
    });
    if (viewportRef) {
      viewportRef.current = viewport;
    }
    // Activate plugins
    viewport.drag().pinch({}).wheel().decelerate().clamp({ direction: 'all', underflow: 'center' });
    if (hasMeasuredFrame(props)) {
      fitViewportToFrame(viewport, props);
    }
    return viewport;
  },
  applyProps(viewport, oldProps: any, newProps: any) {
    const frameChanged =
      oldProps.screenWidth !== newProps.screenWidth ||
      oldProps.screenHeight !== newProps.screenHeight ||
      oldProps.worldWidth !== newProps.worldWidth ||
      oldProps.worldHeight !== newProps.worldHeight;

    Object.keys(newProps).forEach((p) => {
      if (p !== 'app' && p !== 'viewportRef' && p !== 'children' && oldProps[p] !== newProps[p]) {
        // @ts-expect-error Ignoring TypeScript here
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        viewport[p] = newProps[p];
      }
    });

    if (frameChanged && hasMeasuredFrame(newProps)) {
      fitViewportToFrame(viewport, newProps);
    }
  },
});
