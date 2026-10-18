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
  RebuildPageContainer,
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
  textColor?: number // 0~4 brightness
}

/** A simplified image container config */
export interface ImageConfig {
  id: number
  name: string
  x?: number
  y?: number
  width?: number
  height?: number
  zOrderIndex?: number
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
      textColor: config.textColor ?? 4,
    })
  }

  /** Create an ImageContainerProperty from a simplified config */
  createImage(config: ImageConfig): ImageContainerProperty {
    return new ImageContainerProperty({
      xPosition: config.x ?? 0,
      yPosition: config.y ?? 0,
      width: config.width ?? G2_DISPLAY.WIDTH,
      height: config.height ?? G2_DISPLAY.HEIGHT,
      containerID: config.id,
      containerName: config.name,
      zOrderIndex: config.zOrderIndex ?? 0,
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

  /** Render a new page / update page layout using rebuildPageContainer */
  async showPage(
    textContainers: TextContainerProperty[] = [],
    imageContainers: ImageContainerProperty[] = [],
  ): Promise<number> {
    const totalContainers = textContainers.length + imageContainers.length

    const success = await this.bridge.rebuildPageContainer(
      new RebuildPageContainer({
        containerTotalNum: totalContainers,
        textObject: textContainers.length > 0 ? textContainers : undefined,
        imageObject: imageContainers.length > 0 ? imageContainers : undefined,
      })
    )

    if (!success) {
      console.error('rebuildPageContainer failed')
      return 1
    }

    return 0
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

  /**
   * Render the main AuraPet companion HUD on the G2 glasses
   */
  async renderPetHud(
    petContent: string,
    statsContent: string,
    isStartup = false
  ): Promise<number> {
    const containers = [
      // Left container: Pet ASCII Art + Stage (Captures tap events)
      this.createText({
        id: 1,
        name: 'pet_display',
        content: petContent,
        x: 0,
        y: 0,
        width: 260,
        height: 288,
        interactive: true,
        textColor: 4,
      }),
      // Right container: Mood, XP, Prompt & Controls (Display only)
      this.createText({
        id: 2,
        name: 'pet_stats',
        content: statsContent,
        x: 270,
        y: 0,
        width: 306,
        height: 288,
        interactive: false,
        textColor: 4,
      }),
    ]

    if (isStartup) {
      return this.showStartupPage(containers)
    } else {
      return this.showPage(containers)
    }
  }

  /**
   * Render the Wellness Quest / Micro-Step HUD
   */
  async renderQuestHud(questTitle: string, questDetails: string): Promise<number> {
    const containers = [
      this.createText({
        id: 1,
        name: 'quest_title',
        content: questTitle,
        x: 0,
        y: 0,
        width: 576,
        height: 70,
        interactive: false,
        textColor: 4,
      }),
      this.createText({
        id: 2,
        name: 'quest_body',
        content: questDetails,
        x: 0,
        y: 80,
        width: 576,
        height: 208,
        interactive: true,
        textColor: 4,
      }),
    ]

    return this.showPage(containers)
  }

  /**
   * Render Breeding Sanctuary HUD
   */
  async renderBreedingHud(header: string, content: string): Promise<number> {
    const containers = [
      this.createText({
        id: 1,
        name: 'breeding_header',
        content: header,
        x: 0,
        y: 0,
        width: 576,
        height: 70,
        interactive: false,
        textColor: 4,
      }),
      this.createText({
        id: 2,
        name: 'breeding_content',
        content: content,
        x: 0,
        y: 80,
        width: 576,
        height: 208,
        interactive: true,
        textColor: 4,
      }),
    ]

    return this.showPage(containers)
  }

  /** Show the system exit confirmation dialog (required on root page double-tap) */
  exitApp(mode: 0 | 1 = 1): void {
    // mode 1 = system exit-confirmation dialog (required for QA)
    // mode 0 = silent exit (rejected in QA review)
    this.bridge.shutDownPageContainer(mode)
  }

  /** Navigate back or shutdown page container */
  goBack(): void {
    this.bridge.shutDownPageContainer(1)
  }
}

