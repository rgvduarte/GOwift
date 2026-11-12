import { Emitter } from "../util/emitter.js";
import { ClientMessages, parseServerMessage } from "./protocol.js";
import { DEFLATE_RAW, canInflate, createInflater } from "./inflate.js";
import { t } from "../i18n/i18n.js";

/**
 * One connection to a game server.
 *
 * Emits: "state", "resistance", "event", "chat", "error", "close".
 * The WebSocket constructor is injected so tests can use a fake socket.
 */
export class GameConnection extends Emitter {
  #socket = null;
  riderId = null;
  serverInfo = null;
  /** Brings this rider back after a dropped connection (from `joined`, #73). */
  resumeToken = null;
  /** The server's physics for this rider (`joined.physics`, #22), `null` from an older server. */
  physics = null;
  /** How long the server keeps a dropped rider, in seconds (from `welcome`). */
  graceS = 0;

  /**
   * @param {{url: string, createSocket?: (url: string) => WebSocket, canInflate?: boolean}} options
   *   `canInflate`: ask the server for deflate-raw frames (a twelfth of the traffic).
   */
  constructor({ url, createSocket = (u) => new WebSocket(u), canInflate: inflates = canInflate() }) {
    super();
    this.url = url;
    this.createSocket = createSocket;
    this.inflates = inflates;
  }

  /**
   * Connects, performs the hello/join handshake and resolves with the rider id.
   * @param {{name: string, weightKg: number, publicKey?: string}} profile
   */
  join(profile) {
    return new Promise((resolve, reject) => {
      const socket = this.createSocket(this.url);
      this.#socket = socket;
      socket.binaryType = "arraybuffer";
      let joined = false;
      // Set by a deflate-raw welcome: every later frame is binary and goes through it.
      let inflater = null;

      const handle = (text) => {
        const message = parseServerMessage(text);
        if (!message) return;
        switch (message.type) {
          case "welcome":
            this.serverInfo = message;
            this.graceS = message.grace_s ?? 0;
            if (message.compression === DEFLATE_RAW) {
              inflater = createInflater(handle, { onError: () => this.close() });
            }
            this.#send(ClientMessages.join(profile));
            break;
          case "joined":
            joined = true;
            this.riderId = message.rider_id;
            this.resumeToken = message.resume_token ?? null;
            this.physics = message.physics ?? null;
            resolve(message.rider_id);
            break;
          case "error":
            if (!joined) reject(Object.assign(new Error(`${message.code}: ${message.message}`), { code: message.code, serverMessage: message.message }));
            this.emit("error", message);
            break;
          default:
            this.emit(message.type, message);
        }
      };

      socket.addEventListener("open", () => this.#send(ClientMessages.hello(this.inflates ? [DEFLATE_RAW] : [])));
      socket.addEventListener("message", (event) => {
        if (typeof event.data === "string") handle(event.data);
        else inflater?.push(event.data);
      });
      socket.addEventListener("close", () => {
        const closed = () => {
          if (!joined) reject(new Error(t("net.closedBeforeJoin")));
          this.emit("close");
        };
        // Messages sent before the close (a final error) still come first.
        if (inflater) inflater.drained().then(closed);
        else closed();
      });
      socket.addEventListener("error", () => {
        if (!joined) reject(new Error(t("net.cannotConnect", { url: this.url })));
      });
    });
  }

  sendTelemetry(reading) {
    this.#send(ClientMessages.telemetry(reading));
  }

  laneLeft() {
    this.#send(ClientMessages.laneLeft());
  }

  laneRight() {
    this.#send(ClientMessages.laneRight());
  }

  joinRace() {
    this.#send(ClientMessages.joinRace());
  }

  leaveRace() {
    this.#send(ClientMessages.leaveRace());
  }

  joinEvent(id) {
    this.#send(ClientMessages.joinEvent(id));
  }

  leaveEvent() {
    this.#send(ClientMessages.leaveEvent());
  }

  createVehicle(options) {
    this.#send(ClientMessages.createVehicle(options));
  }

  boardVehicle(code) {
    this.#send(ClientMessages.boardVehicle(code));
  }

  leaveVehicle() {
    this.#send(ClientMessages.leaveVehicle());
  }

  /** Tells the server which café workout exercise is under way (`null`: none). */
  workout(exercise, side = null) {
    this.#send(ClientMessages.workout(exercise, side));
  }

  /** Parks the rider for a pause (#89). */
  pause() {
    this.#send(ClientMessages.pause());
  }

  resume() {
    this.#send(ClientMessages.resume());
  }

  /** Tells the server the rider is still there after an AFK warning. */
  stay() {
    this.#send(ClientMessages.stay());
  }

  /** Picks the road for the next junction (`null`: stay on the route). */
  turn(edge) {
    this.#send(ClientMessages.turn(edge));
  }

  startRace(laps) {
    this.#send(ClientMessages.startRace(laps));
  }

  chat(text) {
    if (text.trim()) this.#send(ClientMessages.chat(text));
  }

  close() {
    this.#socket?.close();
  }

  /** Leaves on purpose (no grace period), then closes. */
  leave() {
    this.#send(ClientMessages.leave());
    this.close();
  }

  #send(message) {
    const OPEN = 1;
    if (this.#socket?.readyState === OPEN) this.#socket.send(JSON.stringify(message));
  }
}
