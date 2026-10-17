/**
 * display.ts — G2 Display Manager
 * 
 * Wraps the Even Hub SDK display APIs into a clean interface.
 * The G2 has a 576×288 monochrome green display per eye.
 * 
 * Container types:
 *   - TextContainerProperty: renders text content
 *   - ImageContainerProperty: renders greyscale images  
 *   - ListContainerProperty: renders scrollable lists
 * 
 * Key concepts:
 *   - containerID: unique numeric ID for each container (1-based)
 *   - isEventCapture: set to 1 to receive tap/swipe events on a container
 *   - createStartUpPageContainer: renders the initial page
 *   - textContainerUpgrade: updates an existing text container's content
 */

import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import {
  TextContainerProperty,
  TextContainerUpgrade,
  CreateStartUpPageContainer,
  ImageContainerProperty,
  CreatePageContainer,
} from '@evenrealities/even_hub_sdk'

/** Display constants for the G2 */
export const G2_DISPLAY = {
  WIDTH: 576,
  HEIGHT: 288,
} as const

/** A simplified text container config */
export interface TextConfig {
  id: number
  name: string
  content: string
  x?: number
  y?: number
  width?: number
  height?: number
  interactive?: boolean
  fontSize?: number
}

/** A simplified image container config */
export interface ImageConfig {
  id: number
  name: string
  imageData: string  // base64 encoded greyscale image
  x?: number
  y?: number
  width?: number
  height?: number
  interactive?: boolean
}

/**
 * DisplayManager — high-level wrapper around the G2 display SDK.
 * 
 * Usage:
 *   const display = new DisplayManager(bridge)
 *   await display.showStartupPage([
 *     display.createText({ id: 1, name: 'main', content: 'Hello G2!' })
 *   ])
 *   // Later, update content:
 *   await display.updateText(1, 'main', 'Updated content!')
 */
export class DisplayManager {
  constructor(private bridge: EvenAppBridge) {}

  /** Create a TextContainerProperty from a simplified config */
  createText(config: TextConfig): TextContainerProperty {
    return new TextContainerProperty({
      xPosition: config.x ?? 0,
      yPosition: config.y ?? 0,
      width: config.width ?? G2_DISPLAY.WIDTH,
      height: config.height ?? G2_DISPLAY.HEIGHT,
      borderWidth: 0,
      borderColor: 5,
      paddingLength: 4,
      containerID: config.id,
      containerName: config.name,
      content: config.content,
      isEventCapture: config.interactive ? 1 : 0,
      fontSize: config.fontSize,
    })
  }

  /** Create an ImageContainerProperty from a simplified config */
  createImage(config: ImageConfig): ImageContainerProperty {
    return new ImageContainerProperty({
      xPosition: config.x ?? 0,
      yPosition: config.y ?? 0,
      width: config.width ?? G2_DISPLAY.WIDTH,
      height: config.height ?? G2_DISPLAY.HEIGHT,
      borderWidth: 0,
      borderColor: 5,
      paddingLength: 0,
      containerID: config.id,
      containerName: config.name,
      content: config.imageData,
      isEventCapture: config.interactive ? 1 : 0,
    })
  }

  /** Render the initial startup page with the given containers */
  async showStartupPage(
    textContainers: TextContainerProperty[] = [],
    imageContainers: ImageContainerProperty[] = [],
  ): Promise<number> {
    const totalContainers = textContainers.length + imageContainers.length

    const result = await this.bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: totalContainers,
        textObject: textContainers.length > 0 ? textContainers : undefined,
        imageObject: imageContainers.length > 0 ? imageContainers : undefined,
      })
    )

    if (result !== 0) {
      console.error('createStartUpPageContainer failed:', result)
      // 1 = invalid params, 2 = oversize, 3 = out of memory
    }

    return result
  }

  /** Render a new page (navigates away from current page) */
  async showPage(
    textContainers: TextContainerProperty[] = [],
    imageContainers: ImageContainerProperty[] = [],
  ): Promise<number> {
    const totalContainers = textContainers.length + imageContainers.length

    const result = await this.bridge.createPageContainer(
      new CreatePageContainer({
        containerTotalNum: totalContainers,
        textObject: textContainers.length > 0 ? textContainers : undefined,
        imageObject: imageContainers.length > 0 ? imageContainers : undefined,
      })
    )

    if (result !== 0) {
      console.error('createPageContainer failed:', result)
    }

    return result
  }

  /** Update text in an existing container without re-rendering the full page */
  async updateText(containerId: number, containerName: string, content: string): Promise<void> {
    await this.bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: containerId,
        containerName: containerName,
        content: content,
      })
    )
  }

  /** Show the system exit confirmation dialog (required on root page double-tap) */
  exitApp(mode: 0 | 1 = 1): void {
    // mode 1 = system exit-confirmation dialog (required for QA)
    // mode 0 = silent exit (rejected in QA review)
    this.bridge.shutDownPageContainer(mode)
  }

  /** Navigate back to previous page */
  goBack(): void {
    this.bridge.backPageContainer()
  }
}
