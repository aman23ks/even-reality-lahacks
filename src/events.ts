/**
 * events.ts — G2 Input Event Handler
 * 
 * The G2 glasses support these input events:
 *   - CLICK_EVENT (single tap on the temple touchpad)
 *   - DOUBLE_CLICK_EVENT (double tap)
 *   - LONG_PRESS_EVENT (long press)
 *   - SLIDE_FORWARD_EVENT (swipe forward on touchpad)
 *   - SLIDE_BACKWARD_EVENT (swipe backward on touchpad)
 * 
 * Events arrive through bridge.onEvenHubEvent(). This module provides
 * a typed event system on top of the raw SDK callback.
 */

import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import { OsEventTypeList } from '@evenrealities/even_hub_sdk'

/** Simplified event types for easier handling */
export type G2EventType = 
  | 'tap'
  | 'double_tap'
  | 'long_press'
  | 'swipe_forward'
  | 'swipe_backward'
  | 'unknown'

/** A parsed G2 input event */
export interface G2Event {
  type: G2EventType
  containerId: number
  containerName?: string
  raw: unknown
}

/** Callback type for event handlers */
export type G2EventHandler = (event: G2Event) => void | Promise<void>

/**
 * EventManager — typed event dispatcher for G2 input events.
 * 
 * Usage:
 *   const events = new EventManager(bridge)
 *   events.on('tap', (event) => { ... })
 *   events.on('double_tap', (event) => { ... })
 *   events.onContainer(1, (event) => { ... })  // listen to specific container
 */
export class EventManager {
  private handlers = new Map<G2EventType, G2EventHandler[]>()
  private containerHandlers = new Map<number, G2EventHandler[]>()

  constructor(private bridge: EvenAppBridge) {
    this.setupEventListener()
  }

  /** Register a handler for a specific event type */
  on(type: G2EventType, handler: G2EventHandler): void {
    const existing = this.handlers.get(type) ?? []
    existing.push(handler)
    this.handlers.set(type, existing)
  }

  /** Register a handler for all events on a specific container */
  onContainer(containerId: number, handler: G2EventHandler): void {
    const existing = this.containerHandlers.get(containerId) ?? []
    existing.push(handler)
    this.containerHandlers.set(containerId, existing)
  }

  /** Remove all handlers */
  clear(): void {
    this.handlers.clear()
    this.containerHandlers.clear()
  }

  private setupEventListener(): void {
    this.bridge.onEvenHubEvent((rawEvent) => {
      // Text container events
      const textEvent = rawEvent.textEvent
      if (textEvent) {
        const event = this.parseEvent(textEvent)
        this.dispatch(event)
        return
      }

      // List container events
      const listEvent = rawEvent.listEvent
      if (listEvent) {
        const event = this.parseEvent(listEvent)
        this.dispatch(event)
        return
      }

      // System events (app lifecycle)
      const sysEvent = rawEvent.sysEvent
      if (sysEvent) {
        console.log('[EventManager] System event:', sysEvent)
      }
    })
  }

  private parseEvent(rawEvent: { eventType?: number; containerID?: number; containerName?: string }): G2Event {
    return {
      type: this.mapEventType(rawEvent.eventType),
      containerId: rawEvent.containerID ?? 0,
      containerName: rawEvent.containerName,
      raw: rawEvent,
    }
  }

  private mapEventType(sdkType?: number): G2EventType {
    switch (sdkType) {
      case OsEventTypeList.CLICK_EVENT:
      case undefined: // SDK normalizes 0 to undefined
        return 'tap'
      case OsEventTypeList.DOUBLE_CLICK_EVENT:
        return 'double_tap'
      case OsEventTypeList.LONG_PRESS_EVENT:
        return 'long_press'
      case OsEventTypeList.SLIDE_FORWARD_EVENT:
        return 'swipe_forward'
      case OsEventTypeList.SLIDE_BACKWARD_EVENT:
        return 'swipe_backward'
      default:
        return 'unknown'
    }
  }

  private dispatch(event: G2Event): void {
    // Fire type-specific handlers
    const typeHandlers = this.handlers.get(event.type) ?? []
    for (const handler of typeHandlers) {
      try {
        handler(event)
      } catch (err) {
        console.error('[EventManager] Handler error:', err)
      }
    }

    // Fire container-specific handlers
    const containerHandlers = this.containerHandlers.get(event.containerId) ?? []
    for (const handler of containerHandlers) {
      try {
        handler(event)
      } catch (err) {
        console.error('[EventManager] Container handler error:', err)
      }
    }
  }
}
