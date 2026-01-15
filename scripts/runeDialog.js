import { runeAppliedMessage } from "./messageHelpers.js";
import {
  getEffects,
  getMaxEtchedRunes,
  getYourToken,
  localize,
} from "./misc.js";
import { MODULE_ID } from "./module.js";
import { getAllowedTokenName, getTokenImage } from "./targetDialog.js";
import { invokeRune } from "./invokeRuneDialog.js";

export async function runeEtchTraceDialog(options = {}) {
  const token = getYourToken();
  const actor = token.actor;
  const runesList = actor.items.contents.filter((it) =>
    it.system?.traits?.value?.includes("rune")
  );
  if (runesList.length === 0) {
    ui.notifications.error("You have no Runes");
    return;
  }

  let runes = actor.getFlag(MODULE_ID, "runes");

  if (!runes || Object.keys(runes).length === 0) {
    actor.setFlag(MODULE_ID, "runes", {
      traced: [],
      etched: [],
    });
  }

  const rollData = actor.getRollData();
  let runeData = (
    await Promise.all(
      runesList.map(async (r) => {
        return {
          name: r.name,
          id: r.id,
          uuid: r.uuid,
          img: r.img,
          link: r.link,
          traits: r.system.traits.value,
          effects: getEffects(r.description),
          enriched_desc: (
            await TextEditor.enrichHTML(r.description, { rollData })
          ).replaceAll('"', '&quot;'),
        };
      })
    )
  ).sort((a, b) => a.name.localeCompare(b.name));

  let res = await pickDialog({ runes: runeData, actor, token, options });
}

function formatTraits(traits) {
  if (!traits || traits.length === 0) return '';
  
  return traits
    .map(trait => {
      const label = CONFIG.PF2E?.actionTraits?.[trait] || 
                    CONFIG.PF2E?.featTraits?.[trait] || 
                    CONFIG.PF2E?.spellTraits?.[trait] ||
                    trait.charAt(0).toUpperCase() + trait.slice(1);
      return `<span style="font-size: 0.7em; padding: 2px 5px; background: rgba(0,0,0,0.4); border-radius: 2px; color: #ccc; margin-right: 3px; display: inline-block;">${label}</span>`;
    })
    .join('');
}

async function pickDialog({ runes, actor, token, options }) {
  // Check if there are any etched or traced runes to invoke
  const actorRunes = actor.getFlag(MODULE_ID, "runes");
  const hasAppliedRunes = (actorRunes?.etched?.length > 0) || (actorRunes?.traced?.length > 0);

  // Build a simple table-based layout with radio buttons
  let tableRows = '';
  
  for (let rune of runes) {
    const traitsHtml = formatTraits(rune.traits);
    tableRows += `
      <tr class="rune-select-row" data-rune-id="${rune.id}" data-tooltip="${rune.enriched_desc}" data-tooltip-direction="LEFT">
        <td style="width: 40px; text-align: center; padding: 5px;">
          <input type="radio" name="rune-selection" value="${rune.id}" style="margin: 0; cursor: pointer;">
        </td>
        <td style="width: 50px; text-align: center; padding: 5px;">
          <img src="${rune.img}" style="width: 36px; height: 36px; border-radius: 3px; border: 1px solid #999; display: block; margin: 0 auto;">
        </td>
        <td style="padding: 5px 10px;">
          <div style="font-weight: 600; margin-bottom: 3px;">${rune.name}</div>
          <div style="line-height: 1.4;">${traitsHtml}</div>
        </td>
        <td style="width: 30px; text-align: center;">
          <i class="fas fa-check-circle rune-check-icon" style="color: rgb(234, 74, 114); font-size: 1.2em; opacity: 0;"></i>
        </td>
      </tr>
    `;
  }

  let content = `
    <style>
      .rune-select-table {
        width: 100%;
        border-collapse: collapse;
      }
      .rune-select-row {
        cursor: pointer;
        background: rgba(255, 255, 255, 0.03);
        border: 2px solid transparent;
        transition: all 0.15s ease;
      }
      .rune-select-row:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(234, 74, 114, 0.5);
      }
      .rune-select-row.selected {
        background: rgba(234, 74, 114, 0.25) !important;
        border-color: rgb(234, 74, 114) !important;
      }
      .rune-select-row.selected .rune-check-icon {
        opacity: 1 !important;
      }
      .rune-table-container {
        max-height: 420px;
        overflow-y: auto;
        border: 1px solid #555;
        border-radius: 4px;
      }
      .rune-table-container::-webkit-scrollbar {
        width: 8px;
      }
      .rune-table-container::-webkit-scrollbar-track {
        background: rgba(0, 0, 0, 0.3);
      }
      .rune-table-container::-webkit-scrollbar-thumb {
        background: rgba(234, 74, 114, 0.6);
        border-radius: 4px;
      }
    </style>
    <div class="rune-table-container">
      <table class="rune-select-table">
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    </div>
  `;

  let selectedRuneId = null;

  return new Promise((resolve) => {
    const buttons = [];

    // Add Invoke button at the start if there are applied runes
    if (hasAppliedRunes && !options?.engravingStrikeOnly) {
      buttons.push({
        action: "invoke",
        label: localize("keywords.invoke"),
        callback: async () => {
          // Open the invoke dialog
          const { invokeRuneDialog } = await import("./invokeRuneDialog.js");
          await invokeRuneDialog();
          resolve(null);
        },
        icon: "fa-solid fa-hand-holding-magic",
      });
    }

    if (!options?.traceOnly && !options?.engravingStrikeOnly) {
      buttons.push({
        action: "etch",
        label: localize("keywords.etch"),
        callback: async () => {
          if (!selectedRuneId) {
            ui.notifications.warn("Please select a rune first");
            return;
          }
          await addRune(
            runes.find((s) => s.id === selectedRuneId),
            { actor, token, type: "etched" }
          );
          resolve(selectedRuneId);
        },
        icon: "fa-solid fa-hammer-crash",
      });
    }

    if (!options?.etchOnly && !options?.engravingStrikeOnly) {
      buttons.push(
        {
          label: localize("keywords.trace"),
          action: "trace",
          callback: async () => {
            if (!selectedRuneId) {
              ui.notifications.warn("Please select a rune first");
              return;
            }
            await addRune(
              runes.find((s) => s.id === selectedRuneId),
              { actor, token, type: "traced", action: "1" }
            );
            resolve(selectedRuneId);
          },
          icon: "fa-solid fa-pencil",
        },
        {
          label: `${localize("keywords.trace")} (30 ft)`,
          action: "trace2",
          callback: async () => {
            if (!selectedRuneId) {
              ui.notifications.warn("Please select a rune first");
              return;
            }
            await addRune(
              runes.find((s) => s.id === selectedRuneId),
              { actor, token, type: "traced", action: "2" }
            );
            resolve(selectedRuneId);
          },
          icon: "fa-solid fa-pencil",
        }
      );
    }

    if (!options?.etchOnly && !options?.traceOnly) {
      buttons.push({
        label: localize("keywords.engravingStrike"),
        action: "engravingStrike",
        callback: async () => {
          if (!selectedRuneId) {
            ui.notifications.warn("Please select a rune first");
            return;
          }
          await performEngravingStrike(
            runes.find((s) => s.id === selectedRuneId),
            { actor, token }
          );
          resolve(selectedRuneId);
        },
        icon: "fa-solid fa-sword",
      });
    }

    foundry.applications.api.DialogV2.wait({
      window: {
        title: localize("dialog.etch-trace.title"),
        controls: [
          {
            action: "kofi",
            label: "Support Dev",
            icon: "fa-solid fa-mug-hot fa-beat-fade",
            onClick: () => window.open("https://ko-fi.com/chasarooni", "_blank"),
          },
        ],
        icon: "fas fa-stamp",
      },
      content,
      buttons,
      render: (_event, app) => {
        const html = app.element;
        
        // Handle radio button changes
        html.querySelectorAll('input[name="rune-selection"]').forEach(radio => {
          radio.addEventListener('change', function() {
            if (this.checked) {
              // Remove selected class from all rows
              html.querySelectorAll('.rune-select-row').forEach(r => r.classList.remove('selected'));
              // Add selected class to parent row
              const row = this.closest('.rune-select-row');
              row.classList.add('selected');
              selectedRuneId = this.value;
            }
          });
        });

        // Handle row clicks to also select the radio
        html.querySelectorAll('.rune-select-row').forEach(row => {
          row.addEventListener('click', function(e) {
            // Don't interfere if clicking the radio directly
            if (e.target.type === 'radio') return;
            
            const radio = this.querySelector('input[type="radio"]');
            radio.checked = true;
            radio.dispatchEvent(new Event('change'));
          });

          // Handle right-click for free etching
          row.addEventListener('contextmenu', async function(event) {
            event.preventDefault();
            const runeId = this.dataset.runeId;
            const runeObj = runes.find((s) => s.id === runeId);
            await addRune(runeObj, {
              actor,
              token,
              type: "etched",
              free: true,
            });
            ui.notifications.info(`Free etched: ${runeObj.name}`);
            resolve(runeId);
          });
        });
      },
      position: { width: 540, height: 600 },
    });
  });
}

async function performEngravingStrike(rune, { actor, token }) {
  const meleeWeapons = actor.itemTypes.weapon.filter(w =>
    w.isEquipped && w.isMelee
  );

  if (meleeWeapons.length === 0) {
    ui.notifications.error("You must have an equipped melee weapon to use Engraving Strike");
    return;
  }

  let selectedWeapon;
  if (meleeWeapons.length === 1) {
    selectedWeapon = meleeWeapons[0];
  } else {
    let weaponContent = `
      <form>
        <div class="form-group">
          <label><strong>Select a melee weapon:</strong></label>
          <select name="weaponId" style="width: 100%; margin-top: 8px; padding: 5px;">
            ${meleeWeapons.map(w =>
              `<option value="${w.id}">${w.name}</option>`
            ).join('')}
          </select>
        </div>
      </form>
    `;

    const weaponId = await foundry.applications.api.DialogV2.wait({
      window: {
        title: "Engraving Strike: Select Weapon",
        icon: "fas fa-sword",
      },
      content: weaponContent,
      buttons: [
        {
          action: "select",
          label: "Select",
          icon: "fas fa-check",
          callback: (event, button, dialog) => {
            const html = dialog.element;
            return html.querySelector('select[name="weaponId"]').value;
          }
        },
        {
          action: "cancel",
          label: "Cancel",
          icon: "fas fa-times",
        }
      ],
      position: { width: 400 },
    });

    if (!weaponId) return;
    selectedWeapon = meleeWeapons.find(w => w.id === weaponId);
  }

  const currentTargets = Array.from(game.user.targets);
  if (currentTargets.length === 0) {
    ui.notifications.warn("Please target a token for your Engraving Strike");
    return;
  }

  try {
    ui.notifications.info(`Rolling Engraving Strike with ${selectedWeapon.name}...`);
    
    // Find the strike action for this weapon in the actor's actions
    const strikeActions = actor.system.actions || [];
    const weaponStrike = strikeActions.find(action => 
      action.item?.id === selectedWeapon.id && action.type === 'strike'
    );

    if (!weaponStrike) {
      ui.notifications.error("Could not find strike action for this weapon");
      console.error("Available actions:", strikeActions);
      return;
    }

    // Use the first variant (no MAP penalty)
    const firstVariant = weaponStrike.variants?.[0];
    
    if (!firstVariant) {
      ui.notifications.error("Could not find strike variant");
      return;
    }

    // Roll the attack using the variant's roll method
    const attackRoll = await firstVariant.roll({ 
      skipDialog: false,
      event: new Event('click')
    });

    if (!attackRoll) {
      ui.notifications.warn("Attack roll was cancelled");
      return;
    }

    // Wait for the roll to complete and message to be created
    await new Promise(resolve => setTimeout(resolve, 300));

    // Check if we can determine the outcome from the roll
    let isHit = false;
    
    // Try to get the degree of success
    if (attackRoll.degreeOfSuccess !== undefined) {
      // 0 = critical failure, 1 = failure, 2 = success, 3 = critical success
      isHit = attackRoll.degreeOfSuccess >= 2;
    }

    // If we have the roll options, check for the outcome
    if (attackRoll.options?.degreeOfSuccess !== undefined) {
      isHit = attackRoll.options.degreeOfSuccess >= 2;
    }

    // Ask user to confirm if we can't determine automatically
    const shouldTrace = await foundry.applications.api.DialogV2.wait({
      window: {
        title: "Engraving Strike Result",
        icon: "fas fa-dice-d20",
      },
      content: `
        <div style="text-align: center; padding: 20px;">
          <h3>Did your strike hit?</h3>
          <p>If the strike was successful, the rune <strong>${rune.name}</strong> will be traced on the target.</p>
          ${isHit ? '<p style="color: #4CAF50;"><strong>Auto-detected: HIT</strong></p>' : ''}
        </div>
      `,
      buttons: [
        {
          action: "hit",
          label: "Hit - Trace Rune",
          icon: "fas fa-check-circle",
          default: isHit,
          callback: () => true
        },
        {
          action: "miss",
          label: "Miss - No Trace",
          icon: "fas fa-times-circle",
          callback: () => false
        }
      ],
      position: { width: 450 },
    });

    if (shouldTrace) {
      const targets = currentTargets.map(targetToken => ({
        type: 'person',
        token: targetToken.id,
        actor: targetToken.actor?.id,
        location: 'actor',
        personName: getAllowedTokenName(targetToken),
        img: getTokenImage(targetToken),
        item: null,
        objectName: null
      }));

      for (const target of targets) {
        let runes = actor.getFlag(MODULE_ID, "runes");
        const id = foundry.utils.randomID();

        runes.traced.push({
          rune,
          target,
          id,
        });

        game.pf2eRunesmithAssistant.socket.executeAsGM("createTraceEffect", {
          rune,
          target,
          tokenID: token.id,
          id,
          type: "traced",
        });
        
        await actor.setFlag(MODULE_ID, "runes", runes);
        await runeAppliedMessage({ 
          actor, 
          token, 
          rune, 
          target, 
          type: "traced", 
          action: "1",
          engravingStrike: true 
        });
      }

      ui.notifications.info(`Engraving Strike successful! Traced ${rune.name} on target(s)`);
    } else {
      ui.notifications.info("Strike missed - no rune traced");
    }
  } catch (error) {
    console.error("Engraving Strike error:", error);
    ui.notifications.error("Error performing Engraving Strike. Check console for details.");
  }
}

async function addRune(
  rune,
  { actor, token, type = "etched", action = 0, free }
) {
  const currentTargets = Array.from(game.user.targets);

  if (currentTargets.length === 0) {
    ui.notifications.warn("Please target at least one token before etching/tracing a rune.");
    return;
  }

  const targets = currentTargets.map(targetToken => ({
    type: 'person',
    token: targetToken.id,
    actor: targetToken.actor?.id,
    location: 'actor',
    personName: getAllowedTokenName(targetToken),
    img: getTokenImage(targetToken),
    item: null,
    objectName: null
  }));

  for (const target of targets) {
    let runes = actor.getFlag(MODULE_ID, "runes");
    const id = foundry.utils.randomID();

    if (type === "etched") {
      const maxEtchedRunes = getMaxEtchedRunes(token.actor);
      if (runes.etched.filter((r) => !r.free).length >= maxEtchedRunes) {
        runes.etched.pop();
      }
    }

    runes[type].push({
      rune,
      target,
      id,
      ...(free && { free }),
    });

    game.pf2eRunesmithAssistant.socket.executeAsGM("createTraceEffect", {
      rune,
      target,
      tokenID: token.id,
      id,
      type,
    });
    await actor.setFlag(MODULE_ID, "runes", runes);
    await runeAppliedMessage({ actor, token, rune, target, type, action });
  }
}