/*
* Epinio-owned replacement for @shell/utils/socket. Reconnecting WebSocket wrapper
* used by ApplicationLogs.vue and ApplicationShell.vue to stream logs and drive the
* terminal. Keeps the same constructor args, methods and event names as Shell's
* version so those two components didn't need to change beyond the import.
*
* Left out on purpose: Shell's version also has a one-time, page-global flag that
* permanently disables reconnecting the first time any socket on the page fails to
* ever connect. Nothing in Epinio reads that state, so it isn't replicated here,
* reconnect behavior below is purely per-instance.
*/

const STATE_DISCONNECTED = 'disconnected';
const STATE_CONNECTING = 'connecting';
const STATE_CONNECTED = 'connected';
const STATE_CLOSING = 'closing';
const STATE_RECONNECTING = 'reconnecting';

export const EVENT_CONNECTING = STATE_CONNECTING;
export const EVENT_CONNECTED = STATE_CONNECTED;
export const EVENT_DISCONNECTED = STATE_DISCONNECTED;
export const EVENT_MESSAGE = 'message';
export const EVENT_FRAME_TIMEOUT = 'frame_timeout';
export const EVENT_CONNECT_ERROR = 'connect_error';
export const EVENT_DISCONNECT_ERROR = 'disconnect_error';

let sockId = 1;

export default class Socket extends EventTarget {
  url: string;
  autoReconnect: boolean;
  frameTimeout: number;
  protocol: string | null;
  maxTries: number | null;
  tries = 0;

  private socket: WebSocket | null = null;
  private state = STATE_DISCONNECTED;
  private frameTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private autoReconnectUrl: (() => Promise<string>) | null = null;

  constructor(url: string, autoReconnect = true, frameTimeout: number | null = null, protocol: string | null = null, maxTries: number | null = null) {
    super();

    this.url = url;
    this.autoReconnect = autoReconnect;
    this.frameTimeout = frameTimeout ?? 35000;
    this.protocol = protocol;
    this.maxTries = maxTries;

    this.setUrl(url);
  }

  setUrl(url: string): void {
    if (!url.match(/^wss?:\/\//)) {
      const origin = window.location.origin.replace(/^http/, 'ws');

      url = `${ origin }${ url }`;
    }

    if (window.location.protocol === 'https:' && url.startsWith('ws://')) {
      url = url.replace('ws://', 'wss://');
    }

    this.url = url;
  }

  connect(): void {
    if (this.socket) {
      console.error('Socket already connected');

      return;
    }

    const separator = this.url.includes('?') ? '&' : '?';
    const url = `${ this.url }${ separator }sockId=${ sockId++ }`;

    this.tries++;
    this.state = STATE_CONNECTING;

    this.socket = this.protocol ? new WebSocket(url, this.protocol) : new WebSocket(url);
    this.socket.onopen = () => this._opened();
    this.socket.onmessage = (e) => this._onmessage(e);
    this.socket.onerror = (e) => this._onerror(e);
    this.socket.onclose = () => this._closed();

    this._dispatch(EVENT_CONNECTING);
  }

  disconnect(): Promise<void> {
    this.autoReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    return new Promise((resolve) => {
      if (!this.socket) {
        resolve();

        return;
      }

      this.addEventListener(EVENT_DISCONNECTED, () => resolve(), { once: true });
      this._close();
    });
  }

  send(data: string): boolean {
    if (this.socket && this.state === STATE_CONNECTED) {
      this.socket.send(data);

      return true;
    }

    return false;
  }

  setAutoReconnectUrl(fn: () => Promise<string>): void {
    this.autoReconnectUrl = fn;
  }

  isConnected(): boolean {
    return this.state === STATE_CONNECTED;
  }

  private _close(): void {
    if (this.frameTimer) {
      clearTimeout(this.frameTimer);
    }

    this.state = STATE_CLOSING;
    this.socket?.close();
  }

  private _opened(): void {
    const tries = this.tries;

    this.state = STATE_CONNECTED;
    this.tries = 0;
    this._resetWatchdog();
    this._dispatch(EVENT_CONNECTED, { tries });
  }

  private _onmessage(e: MessageEvent): void {
    this.tries = 0;
    this._resetWatchdog();
    this.dispatchEvent(new CustomEvent(EVENT_MESSAGE, { detail: e }));
  }

  private _onerror(e: Event): void {
    console.error('Socket error', e);
  }

  private _closed(): void {
    this.socket = null;

    if (this.frameTimer) {
      clearTimeout(this.frameTimer);
    }

    if (!this.autoReconnect) {
      this.state = STATE_DISCONNECTED;
      this._dispatch(EVENT_DISCONNECTED);

      return;
    }

    if (this.maxTries && this.tries > this.maxTries) {
      this.state = STATE_DISCONNECTED;
      this._dispatch(EVENT_DISCONNECT_ERROR);

      return;
    }

    this.state = STATE_RECONNECTING;

    if (this.maxTries && this.tries > 1) {
      this._dispatch(EVENT_CONNECT_ERROR);
    }

    this._scheduleReconnect();
    this._dispatch(EVENT_CONNECTING);
  }

  private _scheduleReconnect(): void {
    // Linear backoff: 1s per try, floor 1s, cap 30s.
    const delay = Math.max(1000, Math.min(1000 * this.tries, 30000));

    this.reconnectTimer = setTimeout(async() => {
      if (this.autoReconnectUrl) {
        try {
          this.setUrl(await this.autoReconnectUrl());
        } catch (e) {
          console.error('Unable to refresh socket url before reconnecting', e);

          return;
        }
      }

      this.connect();
    }, delay);
  }

  private _resetWatchdog(): void {
    if (this.frameTimer) {
      clearTimeout(this.frameTimer);
    }

    if (this.frameTimeout) {
      this.frameTimer = setTimeout(() => {
        this._dispatch(EVENT_FRAME_TIMEOUT);
        this._close();
      }, this.frameTimeout);
    }
  }

  private _dispatch(name: string, detail: any = {}): void {
    this.dispatchEvent(new CustomEvent(name, { detail }));
  }
}
