import ByteBuffer from "bytebuffer";

export default class {
  constructor(game) {
    this.game = game;

    this.currentTickNumber = 0;
    this.knownEntities = [];

    this.inSync = true;
    this.outOfSync = false;

    this.packetArr = [];
    this.packetCountLimit = 200;
    this.reconnectSecret = "";

    this.modelProps = {
      Projectile: {
        name: "Projectile",
        index: 0,
        props: ["projectileKind", "position", "tier", "yaw"],
        entityClass: "Projectile",
      },
      ArrowTower: {
        name: "ArrowTower",
        index: 1,
        props: ["aimingYaw", "firingTick", "health", "maxHealth", "position", "tier"],
        entityClass: "Building",
      },
      CannonTower: {
        name: "CannonTower",
        index: 2,
        props: ["aimingYaw", "firingTick", "health", "maxHealth", "position", "tier"],
        entityClass: "Building",
      },
      LightningTower: {
        name: "LightningTower",
        index: 3,
        props: ["firingTick", "health", "maxHealth", "position", "tier"],
        entityClass: "Building",
      },
      MageTower: {
        name: "MageTower",
        index: 4,
        props: ["aimingYaw", "firingTick", "health", "maxHealth", "position", "tier"],
        entityClass: "Building",
      },
      RocketTower: {
        name: "RocketTower",
        index: 5,
        props: ["aimingYaw", "firingTick", "health", "maxHealth", "position", "tier"],
        entityClass: "Building",
      },
      SawTower: {
        name: "SawTower",
        index: 6,
        props: ["firingTick", "health", "maxHealth", "position", "tier", "yaw"],
        entityClass: "Building",
      },
      Wall: {
        name: "Wall",
        index: 7,
        props: ["health", "maxHealth", "position", "tier"],
        entityClass: "Building",
      },
      LargeWall: {
        name: "LargeWall",
        index: 8,
        props: ["health", "maxHealth", "position", "tier"],
        entityClass: "Building",
      },
      Door: {
        name: "Door",
        index: 9,
        props: ["health", "maxHealth", "partyId", "position", "tier"],
        entityClass: "Building",
      },
      SpikeTrap: {
        name: "SpikeTrap",
        index: 10,
        props: ["partyId", "position", "tier"],
        entityClass: "Building",
      },
      Drill: {
        name: "Drill",
        index: 11,
        props: ["health", "maxHealth", "position", "tier"],
        entityClass: "Building",
      },
      Harvester: {
        name: "Harvester",
        index: 12,
        props: ["droneCount", "health", "maxHealth", "position", "targetResourceUid", "tier", "yaw"],
        entityClass: "Building",
      },
      HarvesterDrone: {
        name: "HarvesterDrone",
        index: 13,
        props: ["currentHarvestStage", "health", "maxHealth", "position", "tier", "yaw"],
        entityClass: "Npc",
      },
      ResourcePickup: {
        name: "ResourcePickup",
        index: 14,
        props: ["position", "resourceAmount", "resourcePickupType"],
        entityClass: "ResourcePickup",
      },
      Factory: {
        name: "Factory",
        index: 15,
        props: ["aggroEnabled", "health", "maxHealth", "partyId", "position", "tier"],
        entityClass: "Building",
      },
      Player: {
        name: "Player",
        index: 16,
        privateProps: ["aimingYaw", "dead", "firingTick", "invulnerable", "gold", "health", "lastDamagedTick", "maxHealth", "name", "partyId", "position", "stone", "tokens", "wave", "weaponName", "weaponTier", "wood", "zombieShieldHealth", "zombieShieldMaxHealth"],
        publicProps: ["aimingYaw", "dead", "firingTick", "invulnerable", "health", "lastDamagedTick", "maxHealth", "name", "position", "weaponName", "weaponTier", "zombieShieldHealth", "zombieShieldMaxHealth"],
        entityClass: "Player",
      },
      Resource: {
        name: "Resource",
        index: 17,
        props: ["hits", "position", "radius", "resourceType", "resourceVariant", "yaw"],
        entityClass: "Resource",
      },
      Zombie: {
        name: "Zombie",
        index: 18,
        props: ["colour", "health", "maxHealth", "position", "tier", "yaw"],
        entityClass: "Zombie",
      },
      SpellIndicator: {
        name: "SpellIndicator",
        index: 19,
        props: ["position", "radius", "spellType"],
        entityClass: "Spell",
      },
      Visualiser: {
        name: "Visualiser",
        index: 20,
        props: ["position", "yaw"],
        entityClass: "Visualiser",
      },
    };

    this.propTypes = {
      aimingYaw: "Uint16",
      aggroEnabled: "Boolean",
      currentHarvestStage: "Uint8",
      dead: "Boolean",
      droneCount: "Uint8",
      entityClass: "String",
      experience: "Uint16",
      firingTick: "Uint32",
      hatName: "String",
      health: "Uint32",
      hits: "ArrayUint32",
      lastPetDamage: "Uint16",
      lastPetDamageTarget: "Uint16",
      lastPetDamageTick: "Uint32",
      lastDamagedTick: "Uint32",
      maxHealth: "Uint32",
      gold: "Uint32",
      model: "String",
      name: "String",
      partyId: "Uint32",
      petUid: "Uint64",
      position: "Vector2",
      shortPosition: "Uint16",
      spellType: "String",
      radius: "Uint16",
      resourceAmount: "Uint32",
      resourcePickupType: "Uint8",
      resourceType: "String",
      resourceVariant: "String",
      stone: "Uint32",
      targetResourceUid: "Uint32",
      tier: "Uint8",
      tokens: "Uint32",
      wave: "Uint32",
      weaponName: "String",
      weaponTier: "Uint8",
      wood: "Uint32",
      yaw: "Uint16",
      zombieShieldHealth: "Uint32",
      zombieShieldMaxHealth: "Uint32",
      colour: "ZombieColour",
      scale: "Uint8",
      invulnerable: "Boolean",
      projectileKind: "ProjectileKind",
    };

    this.propTypesArr = Object.keys(this.propTypes);
    this.projectileKinds = ["Arrow", "Cannon", "Dynamite", "Mage", "Rocket"];

    this.clientRpcIndexMap = {
      PartyKey: {
        partyKey: "String",
      },
      PartyBuilding: {
        isArray: true,
        dead: "Boolean",
        tier: "Uint8",
        type: "String",
        uid: "Uint32",
        x: "Uint32",
        y: "Uint32",
        yaw: "Uint16",
      },
      PartyRequest: {
        name: "String",
        uid: "Uint32",
      },
      PartyRequestCancelled: {
        uid: "Uint32",
      },
      PartyRequestMet: {},
      PartyMembersUpdated: {
        isArray: true,
        canPlace: "Boolean",
        canSell: "Boolean",
        name: "String",
        uid: "Uint32",
        isLeader: "Boolean",
      },
      UpdateParty: {
        isArray: true,
        isOpen: "Boolean",
        partyId: "Uint32",
        partyName: "String",
        memberCount: "Uint8",
        memberLimit: "Uint8",
      },
      UpdateLeaderboard: {
        isArray: true,
        uid: "Uint32",
        name: "String",
        score: "Uint64",
        wave: "Uint64",
        rank: "Uint8",
      },
      UpdateDayNightCycle: {
        nightLength: "Uint32",
        dayLength: "Uint32",
      },
      Respawned: {},
      SetTool: {
        isArray: true,
        toolName: "String",
        toolTier: "Uint8",
      },
      Dead: {
        reason: "String",
        wave: "Uint64",
        score: "Uint64",
        partyScore: "Uint64",
      },
      ToolInfo: {
        json: "String",
      },
      BuildingInfo: {
        json: "String",
      },
      SpellInfo: {
        json: "String",
      },
      CastSpellResponse: {
        name: "String",
        cooldown: "Uint32",
        iconCooldown: "Uint32",
      },
      ClearActiveSpell: {
        name: "String",
      },
      EntityData: {
        json: "String",
      },
      Failure: {
        failure: "String",
      },
      ReceiveChatMessage: {
        channel: "String",
        name: "String",
        message: "String",
      },
      DamageDealt: {
        x: "Uint16",
        y: "Uint16",
        damage: "Int32",
      },
      EntityKilled: {
        uid: "Uint32",
        score: "OptionalUint32",
      },
      LightningZap: {
        isArray: true,
        x: "Uint16",
        y: "Uint16",
      },
      SetTickRate: {
        tickRate: "Float",
        serverSpeed: "Uint8",
      },
      AdminCommandResponse: {
        json: "String",
      },
    };

    this.rpcIdToName = [
      "PartyKey",
      "PartyBuilding",
      "PartyRequest",
      "PartyRequestCancelled",
      "PartyRequestMet",
      "PartyMembersUpdated",
      "UpdateParty",
      "UpdateLeaderboard",
      "Respawned",
      "SetTool",
      "Dead",
      "ToolInfo",
      "BuildingInfo",
      "SpellInfo",
      "CastSpellResponse",
      "ClearActiveSpell",
      "EntityData",
      "Failure",
      "ReceiveChatMessage",
      "DamageDealt",
      "LightningZap",
      "SetTickRate",
      "EntityKilled",
      "AdminCommandResponse",
    ];
  }

  setSync(sync, totalSync = false) {
    if (sync != this.inSync) {
      this.inSync = sync;
      if (this.inSync) this.sync(totalSync);
    }
  }

  sync(outOfSync = false) {
    if (1 == this.game.network.connected) {
      if (this.packetArr.length >= this.packetCountLimit || outOfSync) {
        console.log("Tab was hidden for too long. Reporting as desynced.");
        this.packetArr.length = 0;
        this.knownEntities = [];

        this.game.renderer.onServerDesync();
        this.game.renderer.world.onServerDesync();
        this.game.renderer.replicator.onServerDesync();

        this.outOfSync = true;
        this.game.network.sendRpc({
          name: "OutOfSync",
        });
        return;
      }
      if (this.outOfSync) return;
      console.log(
        `Resyncing socket! Decoding ${this.packetArr.length} packets...`,
      );
      while (this.packetArr.length > 0) {
        this.game.network.handleEntityUpdate(this.decode(this.packetArr[0]));
        this.packetArr.shift();
      }
    }
  }

  encode(t, e) {
    const r = new ByteBuffer(100, true);
    r.writeUint8(t);
    switch (t) {
      case 4:
        this.encodeEnterWorld(r, e);
        break;
      case 3:
        this.encodeInput(r, e);
        break;
      case 9:
        this.encodeRpc(r, e);
        break;
      case 7:
        this.setSync("visible" == document.visibilityState);
        break;
    }
    r.flip();
    r.compact();
    return r.toArrayBuffer(false);
  }

  encodeEnterWorld(t, e) {
    t.writeVString(e.name);
    t.writeVString(e.partyKey);
    t.writeVString(e.reconnectSecret || "");
  }

  encodeInput(t, e) {
    const i = {
      x: "Int16",
      y: "Int16",
      mouseMoved: "Uint16",
      mouseDown: "Boolean",
      space: "Boolean",
      up: "Boolean",
      down: "Boolean",
      left: "Boolean",
      right: "Boolean",
    };
    t.writeUint8(Object.keys(e).length);
    for (let s in e) {
      t.writeUint8(Object.keys(i).indexOf(s));
      switch (i[s]) {
        case "Uint16":
          t.writeUint16(e[s]);
          break;
        case "Int16":
          t.writeInt16(e[s]);
          break;
        case "Boolean":
          t.writeUint8(+e[s]);
          break;
        default:
          throw new Error(`Unsupported input attribute type: ${s}`);
      }
    }
  }

  encodeRpc(t, e) {
    const i = {
      OutOfSync: {},
      RandomisePartyKey: {},
      CancelPartyRequest: {},
      TogglePartyVisibility: {},
      Respawn: {},
      TogglePrimaryAggro: {},
      LeaveParty: {},
      UpgradeBuilding: {
        uids: "ArrayUint32",
      },
      SellBuilding: {
        uids: "ArrayUint32",
      },
      UpdateHarvesterTarget: {
        harvesterUid: "Uint32",
        targetUid: "Uint32",
      },
      BuyHarvesterDrone: {
        harvesterUid: "Uint32",
      },
      SendChatMessage: {
        message: "String",
        channel: "String",
      },
      SetPartyName: {
        partyName: "String",
      },
      JoinParty: {
        partyId: "Uint32",
      },
      KickMember: {
        uid: "Uint32",
      },
      TogglePartyPermission: {
        permission: "String",
        uid: "Uint32",
      },
      PartyRequest: {
        name: "String",
        uid: "Uint32",
      },
      PartyRequestResponse: {
        accepted: "Boolean",
        uid: "Uint32",
      },
      PlaceBuilding: {
        x: "Uint16",
        y: "Uint16",
        type: "String",
        yaw: "Uint16",
      },
      BuyTool: {
        toolName: "String",
      },
      EquipTool: {
        toolName: "String",
      },
      CastSpell: {
        spellName: "String",
        x: "Uint32",
        y: "Uint32",
      },
      Admin: {
        password: "String",
      },
      AdminCommand: {
        type: "String",
        uid: "Uint32",
        reason: "String",
        x: "Uint32",
        y: "Uint32",
      },
    };
    t.writeUint8(Object.keys(i).indexOf(e.response.name));
    const s = i[e.response.name];
    for (let i in s) {
      const n = s[i];
      const r = e.response[i];
      switch (n) {
        case "Uint32":
          t.writeUint32(r);
          break;
        case "Int32":
          t.writeInt32(r);
          break;
        case "Float":
          t.writeFloat(r);
          break;
        case "String":
          t.writeVString(r);
          break;
        case "Vector2":
          t.writeVarint32(Math.floor(r.x * 100));
          t.writeVarint32(Math.floor(r.y * 100));
          break;
        case "ArrayVector2":
          t.writeInt32(r.length);
          for (let e = 0; e < r.length; e++) {
            t.writeInt32(r[e].x * 100);
            t.writeInt32(r[e].y * 100);
          }
          break;
        case "ArrayUint32":
          t.writeInt32(r.length);
          for (let e = 0; e < r.length; e++) {
            t.writeInt32(r[e]);
          }
          break;
        case "Uint16":
          t.writeUint16(r);
          break;
        case "Uint8":
          t.writeUint8(r);
          break;
        case "Int16":
          t.writeInt16(r);
          break;
        case "Int8":
          t.writeInt8(r);
          break;
        case "Uint64":
          t.writeUint64(r);
          break;
        case "Int64":
          t.writeInt64(r);
          break;
        case "Double":
          t.writeDouble(r);
          break;
        case "Boolean":
          t.writeUint8(+r);
          break;
        default:
          throw new Error(`Unsupported rpc type: ${n}`);
      }
    }
  }

  decode(t) {
    let e = ByteBuffer.wrap(t);
    e.littleEndian = true;
    const i = e.readUint8();
    if (0 == i && !this.inSync) {
      if (this.packetArr.length < this.packetCountLimit) {
        this.packetArr.push(t);
      }
      e = null;
      return {};
    }
    let s;
    switch (i) {
      case 4:
        s = this.decodeEnterWorld(e);
        break;
      case 0:
        s = this.decodeEntityUpdate(e);
        if (s.unsynced === true) {
          return {};
        }
        break;
      case 9:
        s = this.decodeRpc(e);
        break;
      case 7:
        s = this.decodePing(e);
    }
    s.opcode = i;
    return s;
  }

  decodeEnterWorld(t) {
    if (t.readUint8()) {
      this.reconnectSecret = t.readVString();
      return {
        allowed: true,
        name: t.readVString(),
        uid: t.readUint32(),
        startingTick: t.readUint32(),
        x: t.readUint16(),
        y: t.readUint16(),
        dayLengthMs: t.readUint32(),
        nightLengthMs: t.readUint32(),
        minimumBuildDistanceFromWall: t.readUint8(),
        maxFactoryBuildDistance: t.readUint8(),
        maxPlayerBuildDistance: t.readUint8(),
      };
    } else {
      return {
        allowed: false,
        reason: t.readVString(),
      };
    }
  }

  decodeEntityUpdate(t) {
    let e = ++this.currentTickNumber;
    const i = !!t.readUint8();
    if (i === true) {
      e = t.readUint32();
      this.currentTickNumber = e;
      this.outOfSync = false;
      console.log("Server has resynced, decoding as normal");
    } else if (i === false && this.outOfSync === true) {
      return {
        unsynced: true,
      };
    }
    let s = {};
    for (let t of this.knownEntities) {
      s[t] = true;
    }
    const n = t.readVarint32();
    for (let e = 0; e < n; e++) {
      delete s[t.readUint32()];
    }
    const r = t.readVarint32();
    for (let e = 0; e < r; e++) {
      const e = t.readUint32();
      const i = Object.values(this.modelProps)[t.readUint8()];
      s[e] = {
        uid: e,
        model: i.name,
        entityClass: i.entityClass,
      };
      const n =
        e === this.game.renderer.world.localPlayer
          ? i.privateProps
          : i.props || i.publicProps;
      for (const i of n) {
        const n = this.propTypes[i];
        this.decodeEntityAttributes(s, e, t, i, n);
      }
    }
    const a = t.readVarint32();
    for (let e = 0; e < a; e++) {
      const e = t.readUint32();
      if (s[e] == null || s[e] == 1) {
        s[e] = {};
      }
      const i = t.readUint8();
      for (let n = 0; n < i; n++) {
        const i = t.readUint8();
        const n = this.propTypesArr[i];
        const r = this.propTypes[n];
        this.decodeEntityAttributes(s, e, t, n, r);
      }
    }
    let o;
    this.knownEntities = Object.keys(s);
    if (this.game.ui?.components?.uiDevHud?.devEnabled === true) { // never has one, but ig
      o = t.readUint16() / 100;
    }
    return {
      tick: e,
      entities: s,
      averageServerFrameTime: o,
      byteSize: t.capacity(),
    };
  }

  decodeEntityAttributes(t, e, i, s, n) {
    if (s == "shortPosition") {
      const s = i.readUint8() - 128;
      const n = i.readUint8() - 128;
      t[e].shortPosition = {
        x: s,
        y: n,
      };
      return;
    }
    let r = ["Grey", "Green", "Blue", "Red"];
    switch (n) {
      case "Boolean":
        t[e][s] = !!i.readUint8();
        break;
      case "Uint32":
        t[e][s] = i.readUint32();
        break;
      case "Int32":
        t[e][s] = i.readInt32();
        break;
      case "Float":
        t[e][s] = i.readFloat();
        break;
      case "String":
        t[e][s] = i.readVString();
        break;
      case "ZombieColour":
        t[e][s] = r[i.readUint8()];
        break;
      case "ProjectileKind":
        t[e][s] = this.projectileKinds[i.readUint8()];
        break;
      case "Vector2":
        t[e][s] = {
          x: i.readUint16(),
          y: i.readUint16(),
        };
        break;
      case "ArrayVector2":
        {
          let n = i.readInt32();
          let r = [];
          for (var a = 0; a < n; a++) {
            var o = i.readInt32() / 100;
            var h = i.readInt32() / 100;
            r.push({
              x: o,
              y: h,
            });
          }
          t[e][s] = r;
        }
        break;
      case "ArrayUint32":
        {
          let n = i.readUint16();
          let r = [];
          for (a = 0; a < n; a++) {
            var l = i.readUint32();
            r.push(l);
          }
          t[e][s] = r;
        }
        break;
      case "Uint16":
        t[e][s] = i.readUint16();
        break;
      case "Uint8":
        t[e][s] = i.readUint8();
        break;
      case "Int16":
        t[e][s] = i.readInt16();
        break;
      case "Int8":
        t[e][s] = i.readInt8();
        break;
      case "Uint64":
        t[e][s] = i.readUint64();
        break;
      case "Int64":
        t[e][s] = i.readInt64();
        break;
      case "Double":
        t[e][s] = i.readDouble();
        break;
      case "Varint32":
        t[e][s] = i.readVarint32();
        break;
      default:
        throw new Error(`Unsupported attribute type: ${s}`);
    }
  }

  decodeRpc(t) {
    const e = this.rpcIdToName[t.readUint8()];
    const i = this.clientRpcIndexMap[e];
    const s = {
      name: e,
      response: {},
    };
    if (i.isArray === true) {
      const e = [];
      const n = t.readUint16();
      for (let s = 0; s < n; s++) {
        let s = {};
        for (let e in i) {
          if (e == "isArray") {
            continue;
          }
          let n;
          switch (i[e]) {
            case "Uint8":
              n = t.readUint8();
              break;
            case "Uint16":
              n = t.readUint16();
              break;
            case "Uint32":
              n = t.readUint32();
              break;
            case "OptionalUint32":
              n = t.readUint8() ? t.readUint32() : null;
              break;
            case "Float":
              n = t.readFloat();
              break;
            case "Uint64":
              n = t.readUint64();
              break;
            case "String":
              n = t.readVString();
              break;
            case "Boolean":
              n = !!t.readUint8();
              break;
            default:
              throw new Error(`Unknown RPC type: ${JSON.stringify(i)}`);
          }
          s[e] = n;
        }
        e.push(s);
      }
      s.response = e;
    } else {
      for (let e in i) {
        if (e == "isArray") {
          continue;
        }
        const n = i[e];
        let r;
        switch (n) {
          case "Uint8":
            r = t.readUint8();
            break;
          case "Uint16":
            r = t.readUint16();
            break;
          case "Uint32":
            r = t.readUint32();
            break;
          case "OptionalUint32":
            r = t.readUint8() ? t.readUint32() : null;
            break;
          case "Float":
            r = t.readFloat();
            break;
          case "Uint64":
            r = t.readUint64();
            break;
          case "Int32":
            r = t.readInt32();
            break;
          case "String":
            r = t.readVString();
            break;
          case "Boolean":
            r = !!t.readUint8();
            break;
          default:
            throw new Error(`Unknown RPC type: ${n}`);
        }
        s.response[e] = r;
      }
    }
    return s;
  }

  decodePing(t) {
    return {};
  }
}
