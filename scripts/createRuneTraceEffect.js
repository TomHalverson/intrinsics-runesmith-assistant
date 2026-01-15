import { MODULE_ID } from "./module.js";

export async function createRuneTraceEffect({
  rune,
  target,
  tokenID,
  id,
  type,
}) {
  const { name, img, enriched_desc } = rune;

  const targetToken = canvas.tokens.get(target?.token);
  const tokenSource = canvas.tokens.get(tokenID);

  const person = target?.token ? targetToken?.name : null;
  const object = target?.object;
  const item = target?.item;

  const effectName = `[${type === "etched" ? "Etched" : "Traced"}] ${name}${object || item ? " on " : ""
  }${object || ""}${item || ""}`;

  // Play trace/etch animation based on rune type
  if (type === "traced" || type === "etched") {
    playTraceAnimation(rune, tokenSource, targetToken || tokenSource);
  }

  // Special handling for Esvadir rune - apply to all strikes instead of specific items
  const isEsvadir = name?.toLowerCase().includes("esvadir") ||
                     name?.toLowerCase().includes("whetstone");

  let rules = [];
  if (object) {
    rules = [];
  } else if (isEsvadir) {
    // For Esvadir, add persistent bleed to all strikes
    // 2 persistent bleed per weapon damage die
    rules = [
      {
        key: "FlatModifier",
        selector: ["strike-damage"],
        value: 2,
        damageType: "bleed",
        category: "persistent",
        predicate: [
          {
            or: ["item:trait:piercing", "item:trait:slashing"]
          }
        ]
      }
    ];
  } else {
    rules = rune.effects.map((effectUUID) => ({
      key: "GrantItem",
      onDeleteActions: {
        grantee: "restrict",
      },
      allowDuplicate: true,
      uuid: effectUUID,
    }));
  }

  const effectData = {
    type: "effect",
    name: effectName,
    img: img,
    flags: {
      "pf2e-runesmith-assistant": {
        source: {
          id,
          actorUUID: tokenSource.actor.uuid,
          type,
        },
      },
    },
    system: {
      tokenIcon: { show: true },
      duration: {
        value: 1,
        unit: type === "etched" ? "unlimited" : "rounds",
        sustained: false,
        expiry: "turn-end",
      },
      description: {
        value: enriched_desc,
      },
      unidentified: false,
      traits: {
        custom: "",
        rarity: "common",
        value: rune.traits?.filter(t => t !== "rune") || [],
      },
      rules: rules,
      level: {
        value: tokenSource?.actor?.level ?? 1,
      },
      context: {
        origin: {
          actor: tokenSource.actor.uuid,
          token: tokenSource.uuid,
        },
        target: targetToken?.uuid,
      },
      source: {
        value: "created by PF2e Runesmith Assistant",
      },
      // note: naming this just 'temporary-effect-...' will lead to a PF2E bug, apparently!
      slug: game.pf2e.system.sluggify(name),
    },
  };
  const act = object ? tokenSource.actor : targetToken?.actor;
  const effects = await act.createEmbeddedDocuments("Item", [effectData], {
    parent: tokenSource.actor,
  });
  //console.log({ effects });
  return effects;
}

// Play trace animation based on rune type
function playTraceAnimation(rune, tokenSource, targetToken) {
  // You'll need to get the actual IDs for these runes
  // For now, checking by name - replace with actual source IDs
  const runeName = rune.name?.toLowerCase();
  const runeSourceId = rune.uuid?.split('.').pop(); // Get the ID from UUID if available

  if (runeName?.includes("fire") || runeName?.includes("atryl")) {
    playFireTraceAnimation(tokenSource, targetToken);
  } else if (runeName?.includes("thunder") || runeName?.includes("ranshu")) {
    playThunderTraceAnimation(tokenSource, targetToken);
  } else if (runeName?.includes("esvadir") || runeName?.includes("whetstone")) {
    playEsvadirTraceAnimation(tokenSource, targetToken);
  } else if (runeName?.includes("pluuna") || runeName?.includes("illumination")) {
    playPluunaTraceAnimation(tokenSource, targetToken);
  }
}

function playFireTraceAnimation(token, target) {
  new Sequence({
    moduleName: "PF2e Runesmith Assistant",
    softFail: true,
  })
  .sound()
  .file("psfx.3rd-level-spells.fireball.v1.001.beam")

  .effect()
  .delay(0)
  .file("jb2a.fireball.beam.orange")
  .atLocation(token)
  .stretchTo(target)
  .playbackRate(1)
  .scale(3)
  .waitUntilFinished(-900)

  .effect()
  .file("animated-spell-effects-cartoon.fire.15")
  .atLocation(target)
  .scale(0.3)

  .effect()
  .file("jb2a.magic_signs.rune.02.complete.01.orange")
  .atLocation(target)
  .scale(0.3)

  .sound()
  .file("psfx.casting.fire.001")

  .play({ preload: true });
}

function playThunderTraceAnimation(token, target) {
  new Sequence({
    moduleName: "PF2e Runesmith Assistant",
    softFail: true,
  })
  .sound()
  .file("psfx.3rd-level-spells.fireball.v1.001.beam")

  .effect()
  .delay(0)
  .file("animated-spell-effects-cartoon.electricity.24")
  .atLocation(token)
  .stretchTo(target)
  .playbackRate(1)
  .scale(3)
  .waitUntilFinished(-900)

  .effect()
  .file("jb2a.static_electricity.03.blue")
  .atLocation(target)
  .scale(0.3)

  .effect()
  .file("jb2a.magic_signs.rune.02.complete.03.blue")
  .atLocation(target)
  .scale(0.3)

  .sound()
  .file("graphics-sfx.magic.lightning.cast.02")

  .play({ preload: true });
}

function playEsvadirTraceAnimation(token, target) {
  new Sequence({
    moduleName: "PF2e Runesmith Assistant",
    softFail: true,
  })
  .sound()
  .file("graphics-sfx.sword.melee.impale")
  
  .effect()
  .delay(0)
  .file("blfx.spell.range.beam.eldritch_blast1.color3")
  .atLocation(token)
  .stretchTo(target)
  .playbackRate(1)
  .scale(3)
  .waitUntilFinished(-900)
  
  .effect()
  .file("jb2a.claws.400px.dark_red")
  .atLocation(target)
  .scale(0.3)
  
  .effect()
  .file("jb2a.magic_signs.rune.evocation.complete.red")
  .atLocation(target)
  .scale(0.3)
  
  .sound()
  .file("psfx.casting.fire.001")
  
  .play({ preload: true });
}

function playPluunaTraceAnimation(token, target) {
  new Sequence({
    moduleName: "PF2e Runesmith Assistant",
    softFail: true,
  })
  .sound()
  .file("psfx.3rd-level-spells.fireball.v1.001.beam")
  
  .effect()
  .delay(0)
  .file("blfx.spell.range.projectile.light.guiding_bolt1.color1")
  .atLocation(token)
  .stretchTo(target)
  .playbackRate(1)
  .scale(3)
  .waitUntilFinished(-900)
  
  .effect()
  .file("jblfx.spell.cast.impact.holy_light2.release.color1")
  .atLocation(target)
  .scale(0.3)
  
  .effect()
  .file("jb2a.magic_signs.rune.illusion.complete.yellow")
  .atLocation(target)
  .scale(0.3)
  
  .effect()
  .file("jb2a.markers.light.complete.yellow")
  .atLocation(target)
  .scale(3.5)
  
  .sound()
  .file("graphics-sfx.magic.lightning.cast.02")
  
  .play({ preload: true });
}

export async function createEffect({ tokenID, targetID, effectData }) {
  const targetToken = canvas.tokens.get(targetID);
  const act = targetToken?.actor;

  const effects = await act.createEmbeddedDocuments(
    "Item",
    [
      {
        ...effectData,
      },
    ],
    {
      parent: targetToken.actor,
    }
  );
  return effects;
}