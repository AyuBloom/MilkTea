import Node from "$lib/Models/Node";
import SpriteNode from "$lib/Models/SpriteNode";
import TextNode from "$lib/Models/TextNode";
import LayerNode from "$lib/Models/LayerNode.js";
import EntityNode from "$lib/Models/EntityNode.js";
import GraphicsNode from "$lib/Models/GraphicsNode.js";

import * as PIXI from "pixi.js";
const { Application, Assets, Ticker } = PIXI;

import Replicator from "./Replicator.js";
import World from "./World.js";

import { gameOptions } from "../shared.svelte.js";

import Static from "$lib/static.js";

const SPRITE_SHEET = Static.SPRITE_SHEET;

export default class {
  isWebGl = $state(false);
  constructor(game) {
    this.game = game;

    this.world = new World(this.game);

    this.isInit = false;
    this.initGrass = false;

    this.renderingFilters = [];
    this.fadingAttachments = {};
    this.effects = [];

    this.scale = 1;
    this.zoomDimension = 1.5;

    this.longFrames = 0;
    this.lastMsElapsed = 0;
    this.firstPerformance = null;

    this.followingObject = null;
    this.contextLostTime = 0;

    this.preloadAssets();
    window.addEventListener("resize", this.onWindowResize.bind(this));
    window.onwheel = (t) => {
      if (t.srcElement.classList.contains("hud")) {
        if (t.deltaY > 0) {
          this.zoomDimension = this.zoomDimension + 0.025;
        } else if (t.deltaY < 0) {
          this.zoomDimension = Math.max(0.5, this.zoomDimension - 0.025);
        }
        this.onWindowResize();
      }
    };
  }
  async init() {
    if (this.isInit) return;
    this.isInit = true;

    window.PIXI = PIXI;

    await this.initialiseRendererInstance();
    this.isWebGL = this.renderer.renderer instanceof PIXI.WebGLRenderer;

    this.replicator = new Replicator(this.game);
    this.world.init();
    this.game.eventEmitter.on(
      "EnterWorldResponse",
      this.onEnterWorld.bind(this),
    );
    this.game.eventEmitter.on("LightningZapRpcReceived", this.onLightningZap.bind(this));
  }
  async initialiseRendererInstance() {
    this.ticker = new Ticker();
    this.ticker.add(this.update.bind(this));

    this.renderer = new Application();
    await this.renderer.init({
      preference: "webgpu",
      backgroundColor: 2236962,
      antialias: gameOptions.state.needsRestart["Enable Antialiasing"],
      hello: true,
    });
    this.renderer.canvas.oncontextmenu = (t) => t.preventDefault();
    document.body.children[0].appendChild(this.renderer.canvas);

    if (this.isWebGL) {
      this.renderer.canvas.addEventListener("webglcontextlost", async (t) => {
        document.body.children[0].removeChild(this.renderer.canvas);
        await this.initialiseRendererInstance();
      });
    }

    this.scene = new Node(this.game);

    this.entitiesLayer = new LayerNode(this.game);
    this.uiLayer = new LayerNode(this.game);
    this.groundLayer = new LayerNode(this.game);

    this.buildings = new LayerNode(this.game);
    this.scenery = new LayerNode(this.game);
    this.zombieLayer = new LayerNode(this.game);
    this.npcLayer = new LayerNode(this.game);
    this.projectiles = new LayerNode(this.game);
    this.players = new LayerNode(this.game);

    this.entitiesLayer.addAttachment(this.groundLayer);
    this.entitiesLayer.addAttachment(this.buildings);
    this.entitiesLayer.addAttachment(this.scenery);
    this.entitiesLayer.addAttachment(this.zombieLayer);
    this.entitiesLayer.addAttachment(this.players);
    this.entitiesLayer.addAttachment(this.npcLayer);
    this.entitiesLayer.addAttachment(this.projectiles);
    this.scene.addAttachment(this.entitiesLayer);
    this.scene.addAttachment(this.uiLayer);
    this.hasCreatedGrassBackground = false;
    if (void 0 !== this.worldSize) {
      this.createGrassBackground();
      this.border.setDimensions(
        -1920,
        -1920,
        this.worldSize.x + 3840,
        this.worldSize.y + 3840,
      );
      this.grass.setDimensions(0, 0, this.worldSize.x, this.worldSize.y);
    }
    this.onWindowResize();
    if (1 == this.game.network.connected) {
      this.start();
      for (let t in this.world.entities)
        this.add(this.world.entities[t], this.world.entities[t].entityClass);
    }
  }
  preloadAssets() {
    const t = performance.now(),
      e = SPRITE_SHEET,
      r = new DOMParser()
        .parseFromString(e, "image/svg+xml")
        .querySelectorAll("svg"),
      n = new XMLSerializer();
    let i = [];
    r.forEach((t, e) => {
      if (0 == e) return;
      const r = n.serializeToString(t),
        o = new Blob([r], {
          type: "image/svg+xml",
        }),
        s = URL.createObjectURL(o);
      i.push({
        src: s,
        parser: "loadSVG",
        alias: `./static/images/${t.id}`,
      });
    });
    Assets.load(i).then(() => {
      i.forEach((t) => URL.revokeObjectURL(t.src));
      console.log(
        `Time taken to preload ${i.length} assets: ${performance.now() - t}ms`,
      );
      // document.getElementById("hud-intro-play").classList.remove("is-disabled"),
      i.length = 0;
    });
  }
  onServerDesync() {
    this.clearFadingAttachments();
    console.log("Server desynced, renderer has removed all fading attachments");
  }
  onEnterWorld(t) {
    this.clearFadingAttachments();

    this.start();
    this.worldSize = {
      x: parseInt(t.x),
      y: parseInt(t.y),
    };
    false === this.initGrass && this.createGrassBackground();
    this.border.setDimensions(
      -1920,
      -1920,
      this.worldSize.x + 3840,
      this.worldSize.y + 3840,
    );
    this.grass.setDimensions(0, 0, this.worldSize.x, this.worldSize.y);
  }
  createGrassBackground() {
    this.initGrass = true;

    this.groundEntity = new Node(this.game);

    this.border = new SpriteNode(
      this.game,
      "./static/images/Map/Grass.svg",
      true,
    );
    this.grass = new SpriteNode(
      this.game,
      "./static/images/Map/Grass.svg",
      true,
    );

    this.groundEntity.addAttachment(this.border);
    this.groundEntity.addAttachment(this.grass);

    this.border.setAnchor(0, 0);
    this.border.setAlpha(0.5);
    this.grass.setAnchor(0, 0);

    this.add(this.groundEntity);
  }
  start() {
    this.ticker.start();
    this.onWindowResize();
  }
  add(t, e = void 0) {
    if (t instanceof EntityNode)
      switch (e) {
        case "Building":
          this.buildings.addAttachment(t);
          break;
        case "Resource":
        case "Spell":
        case "ResourcePickup":
          this.scenery.addAttachment(t);
          break;
        case "Zombie":
          this.zombieLayer.addAttachment(t);
          break;
        case "Projectile":
          this.projectiles.addAttachment(t);
          break;
        case "Player":
        case "Pet":
          this.players.addAttachment(t);
          break;
        default:
          this.npcLayer.addAttachment(t);
      }
    else if (t instanceof Node) this.groundLayer.addAttachment(t);
    else {
      if (!(t instanceof TextNode))
        throw new Error(`Unhandled object: ${JSON.stringify(t)}`);
      this.uiLayer.addAttachment(t);
    }
  }
  remove(t, e = true) {
    t.currentModel?.onDie?.();
    let r = "npcLayer";
    if (t instanceof EntityNode)
      switch (t.entityClass) {
        case "Building":
          r = "buildings";
          break;
        case "Resource":
        case "Spell":
        case "ResourcePickup":
          r = "scenery";
          break;
        case "Zombie":
          r = "zombieLayer";
          break;
        case "Projectile":
          r = "projectiles";
          break;
        case "Player":
        case "Pet":
          r = "players";
          break;
        case "Npc":
          r = "npcLayer";
      }
    else
      t instanceof Node
        ? (r = "groundLayer")
        : t instanceof TextNode && (r = "uiLayer");
    if (
      1 == e &&
      true /* 0 == dr.settings.specialEffectsDisabled */ &&
      1 == t.currentModel?.hasDeathFadeEffect
    ) {
      let e = this.generateFadingAttachmentId();
      this.fadingAttachments[e] = t;
      t.currentModel.deathFadeEffect.rendererLayer = r;
      t.currentModel.deathFadeEffect.inUse = true;
      t.currentModel.deathFadeEffect.id = e;
      t.currentModel.deathFadeEffect.diedTick =
        this.replicator.currentTick.tick;
      t.currentModel.deathFadeEffect.lastFramePosition = t.getPosition();
      t.currentModel.deathFadeEffect.lastFrameVelocity = {
        x: t.targetTick.position.x - t.fromTick.position.x,
        y: t.targetTick.position.y - t.fromTick.position.y,
      };
    } else this[r].removeAttachment(t);
  }
  update(t) {
    if (
      this.isWebGL &&
      1 == this.renderer.renderer?.context?.isLost &&
      performance.now() - this.contextLostTime > 5e3
    ) {
      console.log("Context has been lost for too long! Re-initialising PIXI.");
      document.body.removeChild(this.renderer.canvas);
      this.initialisePixiInstance();
      return;
    }
    if (null === this.firstPerformance)
      return (this.firstPerformance = performance.now());
    const e = performance.now(),
      r = e - this.firstPerformance,
      n = r - this.lastMsElapsed;
    this.lastMsElapsed = r;
    t = n; // dr.debug.begin();
    try {
      this.game.eventEmitter.emit("RendererUpdated", {
        msElapsed: t,
      });
    } catch (t) {
      console.warn(
        "Had an issue with the event listener on 'RendererUpdated'.",
        t,
      );
    }
    if (true == this.game.network.connected)
      try {
        this.scene.update(t, null);
      } catch (t) {
        console.warn("Had an issue updating the scene.", t);
      }
    (null !== this.followingObject &&
      this.lookAtPosition(this.followingObject.getPosition()),
      this.renderer.renderer.render(this.scene.getNode()),
      Math.round(100 * (performance.now() - e)) / 100 >= 10 &&
        this.longFrames++);
    for (let e of this.renderingFilters) e.update(t);
    this.updateEffects();
    // game.debug.end();
  }
  clearFadingAttachments() {
    for (let t in this.fadingAttachments) this.deleteFadingAttachment(t);
  }
  generateFadingAttachmentId() {
    const t = Math.floor(1e5 * Math.random());
    return void 0 !== this.fadingAttachments[t]
      ? this.generateFadingAttachmentId()
      : t;
  }
  deleteFadingAttachment(t) {
    const e = this.fadingAttachments[t];
    this[e.currentModel.deathFadeEffect.rendererLayer].removeAttachment(e);
    delete this.fadingAttachments[t];
  }
  onWindowResize() {
    if (null == this.ticker || 0 == this.ticker?.started) return;
    const t = window.innerWidth * window.devicePixelRatio,
      e = window.innerHeight * window.devicePixelRatio,
      r = Math.max(
        t / (1920 * this.zoomDimension),
        e / (1080 * this.zoomDimension),
      );
    this.scale = r;

    this.entitiesLayer.setScale(r);
    this.uiLayer.setScale(r);

    this.renderer.renderer.resize(t, e);
    null !== this.followingObject &&
      this.lookAtPosition(this.followingObject.getPosition());
  }
  lookAtPosition({ x: t, y: e }) {
    const r = (window.innerWidth * window.devicePixelRatio) / 2,
      n = (window.innerHeight * window.devicePixelRatio) / 2;

    t *= this.scale;
    e *= this.scale;

    const i = this.entitiesLayer.getPositionX(),
      o = this.entitiesLayer.getPositionY();

    const s = {
      x: Math.round(100 * (-t + r)) / 100,
      y: Math.round(100 * (-e + n)) / 100,
    };

    this.entitiesLayer.setPosition(s.x, s.y);
    (i === s.x && o === s.y) ||
      this.game.eventEmitter.emit("CameraUpdate", {
        newPosition: s,
      });
  }
  screenToWorld(t, e) {
    let r = -this.entitiesLayer.getPositionX(),
      n = -this.entitiesLayer.getPositionY();
    return (
      (r *= 1 / this.scale),
      (n *= 1 / this.scale),
      {
        x: r + (t *= (1 / this.scale) * window.devicePixelRatio),
        y: n + (e *= (1 / this.scale) * window.devicePixelRatio),
      }
    );
  }
  worldToUi(t, e) {
    let r = -this.entitiesLayer.getPositionX(),
      n = -this.entitiesLayer.getPositionY();
    return (
      (r *= 1 / this.scale),
      (n *= 1 / this.scale),
      {
        x: t - r,
        y: e - n,
      }
    );
  }
  worldToScreen(t, e) {
    let r = -this.entitiesLayer.getPositionX(),
      n = -this.entitiesLayer.getPositionY();
    return (
      (r *= 1 / this.scale),
      (n *= 1 / this.scale),
      {
        x: (t - r) * this.scale * (1 / window.devicePixelRatio),
        y: (e - n) * this.scale * (1 / window.devicePixelRatio),
      }
    );
  }
  screenToYaw(t, e) {
    return (
      Math.round(
        this.game.util.angleTo(
          {
            x: this.getWidth() / 2,
            y: this.getHeight() / 2,
          },
          {
            x: t,
            y: e,
          },
        ),
      ) % 360
    );
  }
  getWidth() {
    return this.renderer.renderer.width / window.devicePixelRatio;
  }
  getHeight() {
    return this.renderer.renderer.height / window.devicePixelRatio;
  }
  onLightningZap(t) {
    this.renderLightning(t);
  }
  renderLightning(t) {
    if (!t || t.length < 2) return;
    const e = new GraphicsNode(this.game);
    this.projectiles.addAttachment(e, 2);
    for (let i = 1; i < t.length; i++)
      this.createLightningSegment(e, t[i - 1], t[i]);
    this.effects.push({
      drawEntity: e,
      createdAt: performance.now(),
    });
  }
  createLightningSegment(t, startPoint, endPoint) {
    const s = this.game.util.angleTo(startPoint, endPoint),
      n = Math.sqrt(this.game.util.measureDistance(startPoint, endPoint)),
      r = 2 * (2 + Math.floor(3 * Math.random()));
    let a = [];
    a.push({
      x: startPoint.x,
      y: startPoint.y,
    });
    let o = {
      x: startPoint.x,
      y: startPoint.y,
    };
    for (let k = 0; k < r; k++) {
      const segmentLen = (n / r) * (0.8 + 0.6 * Math.random()),
        h = (s + (80 * Math.random() - 40) + 360) % 360,
        l = {
          x: o.x + Math.sin((h * Math.PI) / 180) * segmentLen,
          y: o.y - Math.cos((h * Math.PI) / 180) * segmentLen,
        };
      a.push(l);
      o = l;
      if (k > 0 && k < r - 1) {
        const branchAngle = h + (60 * Math.random() - 30),
          branchLen = segmentLen * (0.3 + 0.4 * Math.random()),
          branchPoint = {
            x: l.x + Math.sin((branchAngle * Math.PI) / 180) * branchLen,
            y: l.y - Math.cos((branchAngle * Math.PI) / 180) * branchLen,
          };
        t.draw.moveTo(l.x, l.y);
        t.draw.lineTo(branchPoint.x, branchPoint.y);
        t.draw.stroke({
          width: 2,
          color: 10083839,
          alpha: 0.5,
        });
      }
    }
    a.push({
      x: endPoint.x,
      y: endPoint.y,
    });
    t.draw.moveTo(a[0].x, a[0].y);
    for (let k = 1; k < a.length; k++) t.draw.lineTo(a[k].x, a[k].y);
    t.draw.stroke({
      width: 4,
      color: 53247,
      alpha: 0.4,
    });
    t.draw.moveTo(a[0].x, a[0].y);
    for (let k = 1; k < a.length; k++) t.draw.lineTo(a[k].x, a[k].y);
    t.draw.stroke({
      width: 2,
      color: 16777215,
    });
  }
  updateEffects() {
    const now = performance.now();
    for (let idx = this.effects.length - 1; idx >= 0; idx--) {
      const effect = this.effects[idx],
        elapsed = now - effect.createdAt;
      if (elapsed >= 100) {
        this.projectiles.removeAttachment(effect.drawEntity);
        this.effects.splice(idx, 1);
        continue;
      }
      const fadeStart = 50,
        fadeProgress = Math.min(1, Math.max(0, (elapsed - fadeStart) / (100 - fadeStart))),
        randomAlpha = 0.8 + 0.3 * Math.random();
      effect.drawEntity.setAlpha(Math.max(0, (1 - fadeProgress) * randomAlpha));
    }
  }
}
