/**
 * YOLKSTER CREATOR SETTINGS — the editable data behind /creator.
 *
 * Add a pose, a hoodie colour, a scene or a whole outfit here and it shows
 * up in the tool. Nothing in this file is code you can break the site
 * with: it is lists of names, colours and the WORDS the AI prompt uses.
 *
 *   characters  who can be dressed up, how the prompt describes them, and
 *               their exact colours as measured from the art
 *   wardrobe    clothes per slot
 *   outfits     one-click full outfits
 *   poses       the preset poses
 *   scenes      backgrounds for "scene" shots
 */

import {
  STAND,
  type ArmPose,
  type HandShape,
  type LegPose,
  type Pose,
} from "@/lib/creator/rig";
import {
  PLAIN_FACE,
  type BackKind,
  type BeakKind,
  type BlushKind,
  type BottomLook,
  type BrowKind,
  type Expression,
  type EyeKind,
  type EyewearKind,
  type Face,
  type FaceExtra,
  type GazeKind,
  type HeadwearKind,
  type NeckKind,
  type PetKind,
  type PetSpot,
  type ShoeLook,
  type TopLook,
} from "@/lib/creator/look";

// ============================================================ wardrobe ==

export type SlotId = "top" | "bottom" | "shoes" | "head" | "eyes" | "neck" | "back";

export interface WardrobeItem<L> {
  id: string;
  label: string;
  /**
   * What the prompt says. `{c}` becomes the colour name ("lilac"), `{a}` the
   * second colour. Keep it a plain noun phrase.
   */
  words: string;
  /** how the doll sketches it (null = draws nothing) */
  look: L | null;
  color: string;
  /** second colour, if the item has one */
  accent?: string;
  accentLabel?: string;
}

type TopShape = Omit<TopLook, "color" | "accent">;

export const TOPS: WardrobeItem<TopShape>[] = [
  { id: "hoodie", label: "Hoodie", words: "{c} hoodie with a front pocket", look: { sleeves: "long", hood: true, pocket: true, ribbed: true }, color: "#f08a2c" },
  { id: "sweater", label: "Sweater", words: "{c} chunky knit turtleneck sweater", look: { sleeves: "long", collar: "turtle", ribbed: true }, color: "#b79ad8" },
  { id: "tee", label: "T-shirt", words: "{c} t-shirt", look: { sleeves: "short" }, color: "#4cc9f0" },
  { id: "jersey", label: "Team jersey", words: "{c} short-sleeved esports jersey with {a} trim", look: { sleeves: "short", collar: "vneck" }, color: "#161c3d", accent: "#ffc53d", accentLabel: "Trim" },
  { id: "jacket", label: "Open jacket", words: "{c} jacket worn open over a {a} t-shirt", look: { sleeves: "long", open: true, ribbed: true }, color: "#6f7f4a", accent: "#8e9199", accentLabel: "Shirt" },
  { id: "vest", label: "Utility vest", words: "{c} utility vest with pouches over a {a} long-sleeved top", look: { sleeves: "long", accentSleeves: true, pockets: true }, color: "#3a3d45", accent: "#b79ad8", accentLabel: "Sleeves" },
  { id: "puffer", label: "Puffer coat", words: "{c} puffy winter coat", look: { sleeves: "long", hood: true, ribbed: true }, color: "#d92b2b" },
  { id: "suit", label: "Suit jacket", words: "{c} suit jacket with a {a} shirt and a red tie", look: { sleeves: "long", open: true, tie: true }, color: "#23263a", accent: "#ffffff", accentLabel: "Shirt" },
  { id: "spacesuit", label: "Spacesuit", words: "{c} astronaut spacesuit with {a} trim and a chest control panel", look: { sleeves: "long", panel: true, collar: "ring", onePiece: true }, color: "#f3efe6", accent: "#3a3d45", accentLabel: "Trim" },
  { id: "onesie", label: "Onesie", words: "{c} cosy one-piece pyjama onesie", look: { sleeves: "long", hood: true, onePiece: true }, color: "#7cc4f5" },
  { id: "dress", label: "Dress", words: "{c} short-sleeved dress with a flared skirt", look: { sleeves: "short", skirt: true }, color: "#ff8fb1" },
  { id: "tank", label: "Tank top", words: "{c} tank top", look: { sleeves: "none" }, color: "#ffffff" },
  { id: "other", label: "Something else…", words: "{c} top", look: { sleeves: "long" }, color: "#8b5cf6" },
  { id: "none", label: "No top (bare feathers)", words: "no top, bare yellow feathers", look: null, color: "#ffcf40" },
];

type BottomShape = Omit<BottomLook, "color">;

export const BOTTOMS: WardrobeItem<BottomShape>[] = [
  { id: "jeans", label: "Jeans", words: "{c} jeans", look: { length: "long" }, color: "#4f6fa8" },
  { id: "pants", label: "Trousers", words: "{c} trousers", look: { length: "long" }, color: "#d8bb8c" },
  { id: "cargo", label: "Cargo pants", words: "{c} cargo trousers with side pockets", look: { length: "long", cargo: true }, color: "#3a3d45" },
  { id: "joggers", label: "Joggers", words: "{c} jogger sweatpants", look: { length: "long" }, color: "#23263a" },
  { id: "shorts", label: "Shorts", words: "{c} shorts", look: { length: "short" }, color: "#35cfc9" },
  { id: "skirt", label: "Skirt", words: "{c} skirt", look: { length: "skirt" }, color: "#ff8fb1" },
  { id: "other", label: "Something else…", words: "{c} bottoms", look: { length: "long" }, color: "#8e9199" },
  { id: "none", label: "None (bare feathers)", words: "no trousers, bare yellow feathers", look: null, color: "#ffcf40" },
];

type ShoeShape = Omit<ShoeLook, "color">;

export const SHOES: WardrobeItem<ShoeShape>[] = [
  { id: "sneakers", label: "Sneakers", words: "{c} sneakers", look: { kind: "sneaker" }, color: "#ffffff" },
  { id: "hightops", label: "High-tops", words: "{c} high-top skate shoes with white soles", look: { kind: "hightop" }, color: "#7a4b2e" },
  { id: "boots", label: "Boots", words: "{c} lace-up boots", look: { kind: "boot" }, color: "#8a5230" },
  { id: "sandals", label: "Sandals", words: "{c} sandals", look: { kind: "sandal" }, color: "#b98a5a" },
  { id: "slippers", label: "Slippers", words: "{c} fluffy slippers", look: { kind: "slipper" }, color: "#ffc7d9" },
  { id: "other", label: "Something else…", words: "{c} shoes", look: { kind: "sneaker" }, color: "#8e9199" },
  { id: "none", label: "Barefoot (chick feet)", words: "no shoes, bare orange chick feet", look: null, color: "#ff9a2e" },
];

export const HEADWEAR: WardrobeItem<{ kind: HeadwearKind }>[] = [
  { id: "none", label: "Nothing", words: "nothing on the head", look: null, color: "#ffffff" },
  { id: "cap", label: "Baseball cap", words: "{c} baseball cap", look: { kind: "cap" }, color: "#161c3d" },
  { id: "beanie", label: "Beanie", words: "{c} knit beanie with a pom-pom", look: { kind: "beanie" }, color: "#d92b2b" },
  { id: "headset", label: "Gaming headset", words: "{c} gaming headset with a boom microphone", look: { kind: "headset" }, color: "#23263a" },
  { id: "hood", label: "Hood up", words: "the hood pulled up over the head", look: { kind: "hood" }, color: "#f08a2c" },
  { id: "helmet", label: "Space helmet", words: "clear glass bubble space helmet with a {c} collar ring", look: { kind: "helmet" }, color: "#bfc5cf" },
  { id: "crown", label: "Crown", words: "{c} crown", look: { kind: "crown" }, color: "#ffc53d" },
  { id: "partyhat", label: "Party hat", words: "{c} cone party hat", look: { kind: "partyhat" }, color: "#8b5cf6" },
  { id: "bow", label: "Bow", words: "{c} bow on the side of the head", look: { kind: "bow" }, color: "#ff8fb1" },
  { id: "tophat", label: "Top hat", words: "{c} top hat", look: { kind: "tophat" }, color: "#23263a" },
  { id: "other", label: "Something else…", words: "{c} hat", look: { kind: "generic" }, color: "#4cc9f0" },
];

export const EYEWEAR: WardrobeItem<{ kind: EyewearKind }>[] = [
  { id: "none", label: "Nothing", words: "no glasses", look: null, color: "#ffffff" },
  { id: "glasses", label: "Glasses", words: "round {c} glasses", look: { kind: "glasses" }, color: "#23263a" },
  { id: "sunglasses", label: "Sunglasses", words: "{c} sunglasses", look: { kind: "sunglasses" }, color: "#23263a" },
  { id: "goggles", label: "Goggles / visor", words: "{c} goggles", look: { kind: "goggles" }, color: "#5d6470" },
  { id: "other", label: "Something else…", words: "{c} eyewear", look: { kind: "glasses" }, color: "#4cc9f0" },
];

export const NECKWEAR: WardrobeItem<{ kind: NeckKind }>[] = [
  { id: "none", label: "Nothing", words: "nothing around the neck", look: null, color: "#ffffff" },
  { id: "scarf", label: "Scarf", words: "{c} knitted scarf", look: { kind: "scarf" }, color: "#d92b2b" },
  { id: "bandana", label: "Bandana", words: "{c} bandana tied around the neck", look: { kind: "bandana" }, color: "#ffc53d" },
  { id: "bowtie", label: "Bow tie", words: "{c} bow tie", look: { kind: "bowtie" }, color: "#d92b2b" },
  { id: "medal", label: "Medal", words: "gold medal on a {c} ribbon", look: { kind: "medal" }, color: "#2f6fd6" },
  { id: "other", label: "Something else…", words: "{c} neck accessory", look: { kind: "scarf" }, color: "#4cc9f0" },
];

export const BACKWEAR: WardrobeItem<{ kind: BackKind }>[] = [
  { id: "none", label: "Nothing", words: "nothing on the back", look: null, color: "#ffffff" },
  { id: "cape", label: "Cape", words: "{c} cape flowing from the shoulders", look: { kind: "cape" }, color: "#d92b2b" },
  { id: "backpack", label: "Backpack", words: "{c} backpack", look: { kind: "backpack" }, color: "#4a4f3f" },
  { id: "wings", label: "Wings", words: "small {c} feathered wings", look: { kind: "wings" }, color: "#ffffff" },
  { id: "other", label: "Something else…", words: "{c} item worn on the back", look: { kind: "backpack" }, color: "#8e9199" },
];

export const SLOTS: { id: SlotId; label: string; hint: string }[] = [
  { id: "top", label: "Top", hint: "hoodie, jersey, jacket…" },
  { id: "bottom", label: "Bottoms", hint: "jeans, shorts, skirt…" },
  { id: "shoes", label: "Shoes", hint: "sneakers, boots…" },
  { id: "head", label: "Headwear", hint: "cap, headset, crown…" },
  { id: "eyes", label: "Eyewear", hint: "glasses, goggles…" },
  { id: "neck", label: "Neck", hint: "scarf, medal…" },
  { id: "back", label: "Back", hint: "cape, backpack…" },
];

/** what the doll draws for an item in each slot */
export interface SlotLooks {
  top: TopShape;
  bottom: BottomShape;
  shoes: ShoeShape;
  head: { kind: HeadwearKind };
  eyes: { kind: EyewearKind };
  neck: { kind: NeckKind };
  back: { kind: BackKind };
}

const BY_SLOT: { [K in SlotId]: WardrobeItem<SlotLooks[K]>[] } = {
  top: TOPS,
  bottom: BOTTOMS,
  shoes: SHOES,
  head: HEADWEAR,
  eyes: EYEWEAR,
  neck: NECKWEAR,
  back: BACKWEAR,
};

/** every slot's items, for listing them (labels, default colours) */
export const WARDROBE: Record<SlotId, WardrobeItem<unknown>[]> = BY_SLOT;

/** one slot of an outfit: either "leave it as in the art" or a picked item */
export interface SlotPick {
  /** true = keep whatever the reference art shows */
  keep: boolean;
  id: string;
  color: string;
  accent: string;
  /** free text added to the prompt: "cable-knit", "with a yolk logo"… */
  detail: string;
}

export type OutfitSlots = Record<SlotId, SlotPick>;

const pick = (slot: SlotId, id: string, over: Partial<SlotPick> = {}): SlotPick => {
  const item = WARDROBE[slot].find((i) => i.id === id) ?? WARDROBE[slot][0];
  return { keep: false, id: item.id, color: item.color, accent: item.accent ?? "#ffffff", detail: "", ...over };
};
const asInArt = (slot: SlotId, id: string, over: Partial<SlotPick> = {}): SlotPick => ({
  ...pick(slot, id, over),
  keep: true,
});

// ========================================================== characters ==

export type CharacterId = "dia" | "grai" | "kyle" | "custom";

/** one line of a character's colour list in the prompt */
export interface PaletteEntry {
  part: string;
  hex: string;
  /** an extra few words, e.g. the shading colour */
  note?: string;
}

export interface ReferenceArt {
  /** matches the keys the /creator page passes in */
  key: "casual" | "action";
  label: string;
  /** how the doll is dressed while a slot is left "as in the art" */
  wears: OutfitSlots;
  /**
   * The clothes' colours as MEASURED from this picture. Each one is quoted in
   * the prompt for as long as its slot is left "as in the art".
   */
  colors: (PaletteEntry & { slot: SlotId })[];
}

export interface CreatorCharacter {
  id: CharacterId;
  /** the permanent features, as the prompt describes them */
  identity: string;
  pronoun: "she" | "he" | "they";
  possessive: "her" | "his" | "their";
  /** eye colour on the doll */
  eye: string;
  lashes: boolean;
  blush: boolean;
  expression: Expression;
  /**
   * The character's own colours, MEASURED from the casual art (not picked by
   * eye). The prompt quotes these so the AI can't drift toward a brighter
   * yellow. Re-measure with any colour picker if the art is re-exported.
   */
  palette: PaletteEntry[];
  pet: { kind: PetKind; words: string; spot: PetSpot; fur: string } | null;
  art: ReferenceArt[];
  /** used in downloaded file names, e.g. Dia_Chibi_<tag>-clean.png */
  filePrefix: string;
}

const CHICK =
  "a chibi yellow chick with a big round head, a small body, a three-feather tuft on top of the head and a small orange beak";

export const CHARACTERS: Record<CharacterId, CreatorCharacter> = {
  dia: {
    id: "dia",
    identity: `${CHICK}, large grey-green eyes with long eyelashes and soft pink blush on the cheeks`,
    pronoun: "she",
    possessive: "her",
    eye: "#7d9079",
    lashes: true,
    blush: true,
    expression: "happy",
    palette: [
      { part: "Feathers", hex: "#FED552", note: "shaded areas #F3A23D" },
      { part: "Beak", hex: "#F49C34" },
      { part: "Outlines", hex: "#552013" },
      { part: "Eyes", hex: "#858E76" },
      { part: "Cheek blush", hex: "#FE9574" },
    ],
    pet: { kind: "cat", words: "small grey-and-white kitten", spot: "shoulderL", fur: "#A29897" },
    filePrefix: "Dia",
    art: [
      {
        key: "casual",
        label: "Casual",
        wears: {
          // garment colours below are measured from the art too
          top: asInArt("top", "sweater", { color: "#bc8aaf" }),
          bottom: asInArt("bottom", "jeans", { color: "#65768c" }),
          shoes: asInArt("shoes", "sneakers", { color: "#fdf9f4" }),
          head: asInArt("head", "none"),
          eyes: asInArt("eyes", "none"),
          neck: asInArt("neck", "none"),
          back: asInArt("back", "none"),
        },
        colors: [
          { slot: "top", part: "Sweater", hex: "#BC8AAF" },
          { slot: "bottom", part: "Jeans", hex: "#65768C" },
          { slot: "shoes", part: "Sneakers", hex: "#FDF9F4" },
        ],
      },
      {
        key: "action",
        label: "Tactical",
        wears: {
          top: asInArt("top", "vest", { color: "#5b5a62", accent: "#ac87a7" }),
          bottom: asInArt("bottom", "cargo", { color: "#595c64" }),
          shoes: asInArt("shoes", "boots", { color: "#544c58" }),
          head: asInArt("head", "headset", { color: "#8f6fc0" }),
          eyes: asInArt("eyes", "none"),
          neck: asInArt("neck", "none"),
          back: asInArt("back", "none"),
        },
        colors: [
          { slot: "top", part: "Vest", hex: "#5B5A62", note: "pouches #C693CE, sleeves #AC87A7" },
          { slot: "bottom", part: "Trousers", hex: "#595C64" },
          { slot: "shoes", part: "Boots", hex: "#544C58" },
        ],
      },
    ],
  },
  grai: {
    id: "grai",
    identity: `${CHICK}, large green eyes`,
    pronoun: "he",
    possessive: "his",
    eye: "#6f9a3a",
    lashes: false,
    blush: false,
    expression: "smile",
    palette: [
      { part: "Feathers", hex: "#FED95D", note: "shaded areas #F4AB43" },
      { part: "Beak", hex: "#FBA334" },
      { part: "Outlines", hex: "#4E1E0F" },
      { part: "Eyes", hex: "#52602F" },
    ],
    pet: null,
    filePrefix: "Grai",
    art: [
      {
        key: "casual",
        label: "Casual",
        wears: {
          top: asInArt("top", "jacket", { color: "#7a784d", accent: "#aba5a5" }),
          bottom: asInArt("bottom", "pants", { color: "#d0ae83" }),
          shoes: asInArt("shoes", "boots", { color: "#a35e37" }),
          head: asInArt("head", "none"),
          eyes: asInArt("eyes", "none"),
          neck: asInArt("neck", "none"),
          back: asInArt("back", "none"),
        },
        colors: [
          { slot: "top", part: "Jacket", hex: "#7A784D", note: "t-shirt underneath #ABA5A5" },
          { slot: "bottom", part: "Trousers", hex: "#D0AE83" },
          { slot: "shoes", part: "Boots", hex: "#A35E37" },
        ],
      },
      {
        key: "action",
        label: "Hacker",
        wears: {
          top: asInArt("top", "hoodie", { color: "#56565b" }),
          bottom: asInArt("bottom", "cargo", { color: "#be9d7e" }),
          shoes: asInArt("shoes", "boots", { color: "#905335" }),
          head: asInArt("head", "hood", { color: "#56565b" }),
          eyes: asInArt("eyes", "goggles", { color: "#5d6470" }),
          neck: asInArt("neck", "none"),
          back: asInArt("back", "backpack", { color: "#514843" }),
        },
        colors: [
          { slot: "top", part: "Hoodie", hex: "#56565B" },
          { slot: "bottom", part: "Cargo trousers", hex: "#BE9D7E" },
          { slot: "shoes", part: "Boots", hex: "#905335" },
          { slot: "back", part: "Backpack", hex: "#514843" },
        ],
      },
    ],
  },
  kyle: {
    id: "kyle",
    identity: `${CHICK}, large warm-brown eyes`,
    pronoun: "he",
    possessive: "his",
    eye: "#7a4a22",
    lashes: false,
    blush: false,
    expression: "smile",
    palette: [
      { part: "Feathers", hex: "#FED564", note: "shaded areas #F2A342" },
      { part: "Beak", hex: "#FEA235" },
      { part: "Outlines", hex: "#582617" },
      { part: "Eyes", hex: "#542315", note: "lighter lower iris #AC7651" },
    ],
    pet: { kind: "koala", words: "small grey koala", spot: "shoulderL", fur: "#BAB6B8" },
    filePrefix: "Koala",
    art: [
      {
        key: "casual",
        label: "Casual",
        wears: {
          top: asInArt("top", "hoodie", { color: "#e5803b" }),
          bottom: asInArt("bottom", "jeans", { color: "#647d93" }),
          shoes: asInArt("shoes", "hightops", { color: "#90583b" }),
          head: asInArt("head", "none"),
          eyes: asInArt("eyes", "none"),
          neck: asInArt("neck", "none"),
          back: asInArt("back", "none"),
        },
        colors: [
          { slot: "top", part: "Hoodie", hex: "#E5803B" },
          { slot: "bottom", part: "Jeans", hex: "#647D93" },
          { slot: "shoes", part: "Shoes", hex: "#90583B" },
        ],
      },
      {
        key: "action",
        label: "Climber",
        wears: {
          top: asInArt("top", "hoodie", { color: "#e5803b" }),
          bottom: asInArt("bottom", "jeans", { color: "#647d93" }),
          shoes: asInArt("shoes", "hightops", { color: "#90583b" }),
          head: asInArt("head", "none"),
          eyes: asInArt("eyes", "none"),
          neck: asInArt("neck", "none"),
          back: asInArt("back", "none"),
        },
        colors: [
          { slot: "top", part: "Hoodie", hex: "#E5803B" },
          { slot: "bottom", part: "Jeans", hex: "#647D93" },
          { slot: "shoes", part: "Shoes", hex: "#90583B" },
        ],
      },
    ],
  },
  /** someone new: the user uploads their own reference picture */
  custom: {
    id: "custom",
    identity: "the character shown in the reference image",
    pronoun: "they",
    possessive: "their",
    eye: "#6b4a2b",
    lashes: false,
    blush: false,
    expression: "smile",
    palette: [], // an uploaded picture's main colours are measured in the browser instead
    pet: null,
    filePrefix: "Yolkster",
    art: [
      {
        key: "casual",
        label: "Your upload",
        wears: {
          top: asInArt("top", "tee", { color: "#c9ccd3" }),
          bottom: asInArt("bottom", "pants", { color: "#8e9199" }),
          shoes: asInArt("shoes", "sneakers", { color: "#ffffff" }),
          head: asInArt("head", "none"),
          eyes: asInArt("eyes", "none"),
          neck: asInArt("neck", "none"),
          back: asInArt("back", "none"),
        },
        colors: [],
      },
    ],
  },
};

// ============================================================= outfits ==

export interface OutfitPreset {
  id: string;
  label: string;
  /** slots not listed stay as they are */
  slots: Partial<OutfitSlots>;
  /** optional held item */
  item?: string;
}

export const OUTFITS: OutfitPreset[] = [
  {
    id: "jersey",
    label: "Team jersey",
    slots: {
      top: pick("top", "jersey", { detail: "with a small cracked-egg emblem on the chest" }),
      bottom: pick("bottom", "joggers", { color: "#23263a" }),
      shoes: pick("shoes", "sneakers", { color: "#ffffff" }),
      head: pick("head", "headset", { color: "#ffc53d" }),
      eyes: pick("eyes", "none"),
      neck: pick("neck", "none"),
      back: pick("back", "none"),
    },
  },
  {
    id: "space",
    label: "Crest spacesuit",
    slots: {
      top: pick("top", "spacesuit", { color: "#f3efe6", accent: "#4cc9f0", detail: "with gold piping, matching the team crest" }),
      bottom: pick("bottom", "other", { color: "#f3efe6", detail: "spacesuit legs" }),
      shoes: pick("shoes", "boots", { color: "#c9ccd3", detail: "chunky space boots" }),
      head: pick("head", "helmet", { color: "#ffc53d" }),
      eyes: pick("eyes", "none"),
      neck: pick("neck", "none"),
      back: pick("back", "none"),
    },
  },
  {
    id: "streamer",
    label: "Streamer",
    slots: {
      top: pick("top", "hoodie", { color: "#7b3ff2" }),
      bottom: pick("bottom", "joggers", { color: "#3a3d45" }),
      shoes: pick("shoes", "slippers", { color: "#ffc7d9" }),
      head: pick("head", "headset", { color: "#23263a" }),
      eyes: pick("eyes", "none"),
      neck: pick("neck", "none"),
      back: pick("back", "none"),
    },
    item: "a game controller",
  },
  {
    id: "contestant",
    label: "Arena contestant",
    slots: {
      top: pick("top", "vest", { color: "#3a3d45", accent: "#ffc53d", detail: "sporty game-show contestant gear with a number patch" }),
      bottom: pick("bottom", "cargo", { color: "#23263a" }),
      shoes: pick("shoes", "boots", { color: "#3a3d45" }),
      head: pick("head", "none"),
      eyes: pick("eyes", "goggles", { color: "#4cc9f0" }),
      neck: pick("neck", "none"),
      back: pick("back", "backpack", { color: "#3a3d45" }),
    },
  },
  {
    id: "winter",
    label: "Winter",
    slots: {
      top: pick("top", "puffer", { color: "#2f6fd6" }),
      bottom: pick("bottom", "pants", { color: "#3a3d45" }),
      shoes: pick("shoes", "boots", { color: "#7a4b2e" }),
      head: pick("head", "beanie", { color: "#d92b2b" }),
      eyes: pick("eyes", "none"),
      neck: pick("neck", "scarf", { color: "#ffc53d" }),
      back: pick("back", "none"),
    },
  },
  {
    id: "beach",
    label: "Beach day",
    slots: {
      top: pick("top", "tee", { color: "#ff6f61", detail: "with a tropical print" }),
      bottom: pick("bottom", "shorts", { color: "#35cfc9" }),
      shoes: pick("shoes", "sandals", { color: "#b98a5a" }),
      head: pick("head", "cap", { color: "#ffffff" }),
      eyes: pick("eyes", "sunglasses", { color: "#23263a" }),
      neck: pick("neck", "none"),
      back: pick("back", "none"),
    },
  },
  {
    id: "formal",
    label: "Awards night",
    slots: {
      top: pick("top", "suit", { color: "#23263a", accent: "#ffffff" }),
      bottom: pick("bottom", "pants", { color: "#23263a" }),
      shoes: pick("shoes", "other", { color: "#141416", detail: "polished dress shoes" }),
      head: pick("head", "none"),
      eyes: pick("eyes", "none"),
      neck: pick("neck", "none"),
      back: pick("back", "none"),
    },
  },
  {
    id: "hero",
    label: "Superhero",
    slots: {
      top: pick("top", "tee", { color: "#2f6fd6", detail: "tight superhero top with a yellow egg emblem" }),
      bottom: pick("bottom", "other", { color: "#2f6fd6", detail: "superhero tights" }),
      shoes: pick("shoes", "boots", { color: "#d92b2b" }),
      head: pick("head", "none"),
      eyes: pick("eyes", "other", { color: "#d92b2b", detail: "a small domino mask" }),
      neck: pick("neck", "none"),
      back: pick("back", "cape", { color: "#d92b2b" }),
    },
  },
  {
    id: "pyjamas",
    label: "Pyjamas",
    slots: {
      top: pick("top", "onesie", { color: "#7cc4f5", detail: "with a star pattern" }),
      bottom: pick("bottom", "other", { color: "#7cc4f5", detail: "onesie legs" }),
      shoes: pick("shoes", "slippers", { color: "#ffffff" }),
      head: pick("head", "none"),
      eyes: pick("eyes", "none"),
      neck: pick("neck", "none"),
      back: pick("back", "none"),
    },
  },
];

/** quick-pick colours next to every colour picker */
export const SWATCHES = [
  "#ffc53d", // yolk gold
  "#161c3d", // team navy
  "#4cc9f0", // shield cyan
  "#8b5cf6", // nebula purple
  "#ffffff",
  "#23263a",
  "#d92b2b",
  "#f08a2c",
  "#3fa24a",
  "#2f6fd6",
  "#b79ad8",
  "#ff8fb1",
  "#7a4b2e",
  "#8e9199",
];

// ========================================================= expressions ==

const face = (over: Partial<Face>): Face => ({ ...PLAIN_FACE, ...over });

/**
 * Ready-made faces. Each is just a starting point: every piece (eyes, brows,
 * beak, blush, gaze, extras) can then be changed on its own.
 * Remember eyeL is the character's LEFT eye, on the right of the screen.
 */
export const EXPRESSIONS: { id: Expression; label: string; words: string; face: Face }[] = [
  { id: "smile", label: "Smile", words: "a gentle closed-beak smile", face: face({}) },
  { id: "happy", label: "Happy", words: "a big happy smile with the beak open", face: face({ beak: "open" }) },
  {
    id: "laugh",
    label: "Laughing",
    words: "laughing, eyes squeezed shut and beak wide open",
    face: face({ eyeR: "happy", eyeL: "happy", brows: "raised", beak: "wide" }),
  },
  {
    id: "wink",
    label: "Wink",
    words: "a playful wink (the left eye, on the viewer's right, shut) with an open smile",
    face: face({ eyeL: "happy", beak: "open" }),
  },
  {
    id: "cheeky",
    label: "Cheeky",
    words: "cheeky: winking (the left eye, on the viewer's right, shut) with the tongue poking out",
    face: face({ eyeL: "happy", beak: "tongue" }),
  },
  {
    id: "excited",
    label: "Excited",
    words: "thrilled: big sparkling eyes and the beak wide open, with little sparkles around the head",
    face: face({ eyeR: "sparkle", eyeL: "sparkle", brows: "raised", beak: "wide", extras: ["sparkles"] }),
  },
  {
    id: "love",
    label: "In love",
    words: "smitten: heart-shaped eyes, extra blush and an open smile, with little hearts floating beside the head",
    face: face({ eyeR: "heart", eyeL: "heart", brows: "raised", beak: "open", blush: "extra", extras: ["hearts"] }),
  },
  {
    id: "determined",
    label: "Determined",
    words: "a confident, determined look: narrowed eyes, firm brows and a slight smirk",
    face: face({ eyeR: "narrow", eyeL: "narrow", brows: "stern", beak: "smirk" }),
  },
  {
    id: "surprised",
    label: "Surprised",
    words: "surprised, wide eyes and a small round open beak",
    face: face({ eyeR: "wide", eyeL: "wide", brows: "raised", beak: "o" }),
  },
  {
    id: "worried",
    label: "Worried",
    words: "worried: wide eyes, upturned brows and a small round beak, with a cartoon sweat drop",
    face: face({ eyeR: "wide", eyeL: "wide", brows: "worried", beak: "o", extras: ["sweat"] }),
  },
  { id: "smug", label: "Smug", words: "smug, half-lidded eyes and a sly smirk", face: face({ eyeR: "half", eyeL: "half", beak: "smirk" }) },
  {
    id: "shy",
    label: "Shy",
    words: "a shy bashful smile with extra blush, eyes glancing down",
    face: face({ brows: "worried", blush: "extra", gaze: "down" }),
  },
  { id: "sleepy", label: "Sleepy", words: "sleepy, eyes almost closed", face: face({ eyeR: "sleepy", eyeL: "sleepy" }) },
  {
    id: "sad",
    label: "Sad",
    words: "sad: half-closed downcast eyes, worried brows, a pout and a single tear",
    face: face({ eyeR: "half", eyeL: "half", brows: "worried", beak: "frown", gaze: "down", extras: ["tear"] }),
  },
  {
    id: "grumpy",
    label: "Grumpy",
    words: "a comically grumpy pout with furrowed brows",
    face: face({ eyeR: "narrow", eyeL: "narrow", brows: "stern", beak: "frown" }),
  },
  {
    id: "angry",
    label: "Angry",
    words: "comically angry: narrowed eyes, furrowed brows, a pout and a cartoon anger mark",
    face: face({ eyeR: "narrow", eyeL: "narrow", brows: "stern", beak: "frown", extras: ["anger"] }),
  },
];

export const faceOf = (id: Expression): Face => (EXPRESSIONS.find((e) => e.id === id) ?? EXPRESSIONS[0]).face;

/** the pieces of a face: what the picker calls each one, and what the prompt says */
export const EYES: { id: EyeKind; label: string; words: string }[] = [
  { id: "open", label: "Open", words: "open" },
  { id: "wide", label: "Wide", words: "wide open" },
  { id: "narrow", label: "Narrowed", words: "narrowed" },
  { id: "half", label: "Half-lidded", words: "half-lidded" },
  { id: "sleepy", label: "Sleepy", words: "almost closed" },
  { id: "happy", label: "Happy shut", words: "squeezed shut in a happy arc" },
  { id: "closed", label: "Closed", words: "gently closed" },
  { id: "sparkle", label: "Sparkly", words: "big and sparkling" },
  { id: "heart", label: "Hearts", words: "heart-shaped" },
];

export const BROWS: { id: BrowKind; label: string; words: string }[] = [
  { id: "soft", label: "Soft", words: "" },
  { id: "raised", label: "Raised", words: "eyebrows raised" },
  { id: "stern", label: "Stern", words: "eyebrows drawn down, stern" },
  { id: "worried", label: "Worried", words: "worried, upturned eyebrows" },
  { id: "skeptical", label: "One up", words: "one eyebrow raised" },
  { id: "none", label: "None", words: "no eyebrows" },
];

export const BEAKS: { id: BeakKind; label: string; words: string }[] = [
  { id: "smile", label: "Smile", words: "beak closed in a gentle smile" },
  { id: "open", label: "Open", words: "beak open in a smile" },
  { id: "wide", label: "Wide open", words: "beak wide open" },
  { id: "o", label: "Small o", words: "beak in a small round o" },
  { id: "frown", label: "Pout", words: "beak closed in a pout" },
  { id: "smirk", label: "Smirk", words: "a lopsided smirk" },
  { id: "tongue", label: "Tongue out", words: "beak open with the tongue poking out" },
];

export const BLUSHES: { id: BlushKind; label: string; words: string }[] = [
  { id: "auto", label: "As usual", words: "" },
  { id: "none", label: "None", words: "no blush on the cheeks" },
  { id: "extra", label: "Extra", words: "extra blush on the cheeks" },
];

export const GAZES: { id: GazeKind; label: string; words: string }[] = [
  { id: "ahead", label: "Ahead", words: "" },
  { id: "up", label: "Up", words: "eyes glancing up" },
  { id: "down", label: "Down", words: "eyes glancing down" },
  { id: "left", label: "Left", words: "eyes glancing toward the viewer's left" },
  { id: "right", label: "Right", words: "eyes glancing toward the viewer's right" },
];

export const EXTRAS: { id: FaceExtra; label: string; words: string }[] = [
  { id: "sweat", label: "Sweat drop", words: "a cartoon sweat drop at the temple" },
  { id: "sparkles", label: "Sparkles", words: "little sparkles around the head" },
  { id: "anger", label: "Anger mark", words: "a cartoon anger mark by the forehead" },
  { id: "tear", label: "Tear", words: "a tear at the corner of one eye" },
  { id: "hearts", label: "Hearts", words: "little hearts floating beside the head" },
  { id: "zzz", label: "Zzz", words: "a Zzz sleep symbol above the head" },
  { id: "question", label: "?", words: "a question mark above the head" },
  { id: "exclaim", label: "!", words: "an exclamation mark above the head" },
  { id: "music", label: "Music", words: "music notes floating beside the head" },
];

export const HANDS: { id: HandShape; label: string }[] = [
  { id: "relaxed", label: "Relaxed" },
  { id: "flat", label: "Flat" },
  { id: "open", label: "Spread" },
  { id: "fist", label: "Fist" },
  { id: "point", label: "Pointing" },
  { id: "thumb", label: "Thumb up" },
  { id: "thumbDown", label: "Thumb down" },
  { id: "peace", label: "Peace" },
  { id: "rock", label: "Rock on" },
  { id: "grip", label: "Gripping" },
  { id: "palmUp", label: "Palm up" },
];

// =============================================================== poses ==

export interface PosePreset {
  id: string;
  label: string;
  /** a few words for the prompt: "waving hello" */
  words: string;
  pose: Pose;
  /** the face that suits it; applied with the preset */
  expression?: Expression;
}

const arm = (
  shoulder: number,
  elbow: number,
  layer: ArmPose["layer"] = "mid",
  hand: HandShape = "relaxed",
  wrist = 0,
): ArmPose => ({ shoulder, elbow, wrist, layer, hand, palm: "auto" });
const leg = (hip: number, knee = 0, foot = 0, layer: LegPose["layer"] = "back", flip = false): LegPose => ({
  hip,
  knee,
  foot,
  layer,
  flip,
});
const pose = (over: Partial<Pose>): Pose => ({ ...STAND, ...over });

const ON_HIP = [38, -95] as const;
// short arms + a big head: raised arms angle outward so the hands clear the head
const RAISED = [112, 34] as const;

/**
 * Reminder: "R" is the character's right, which is the LEFT of the screen
 * when the doll faces you. Arm angles: 0 down · 90 out · 180 up.
 */
export const POSES: PosePreset[] = [
  { id: "stand", label: "Stand", words: "standing relaxed", pose: STAND },
  {
    id: "wave",
    label: "Wave",
    words: "waving hello",
    expression: "happy",
    pose: pose({ head: 4, armR: arm(108, 40, "mid", "open"), armL: arm(30, -75) }),
  },
  {
    id: "hips",
    label: "Hands on hips",
    words: "standing proud with both hands on the hips",
    expression: "determined",
    pose: pose({ armR: arm(...ON_HIP), armL: arm(...ON_HIP), legL: leg(12), legR: leg(12) }),
  },
  {
    id: "cheer",
    label: "Cheer",
    words: "cheering with both arms thrown up",
    expression: "laugh",
    pose: pose({ armR: arm(...RAISED, "mid", "open"), armL: arm(...RAISED, "mid", "open"), legL: leg(11), legR: leg(11) }),
  },
  {
    id: "point",
    label: "Point",
    words: "pointing off to the side",
    expression: "happy",
    pose: pose({ lookX: 0.45, head: 3, armL: arm(98, 6, "mid", "point"), armR: arm(...ON_HIP) }),
  },
  {
    id: "thumbs",
    label: "Thumbs-up",
    words: "giving a thumbs-up",
    expression: "wink",
    pose: pose({ head: -5, armR: arm(48, 100, "front", "thumb"), armL: arm(20, -12) }),
  },
  {
    id: "peace",
    label: "Peace",
    words: "flashing a peace sign beside the face",
    expression: "wink",
    pose: pose({ head: -8, armR: arm(105, 70, "front", "peace"), armL: arm(...ON_HIP) }),
  },
  {
    id: "victory",
    label: "Fist pump",
    words: "pumping one fist in the air in victory",
    expression: "happy",
    pose: pose({ head: 5, armR: arm(112, 38, "mid", "fist"), armL: arm(...ON_HIP), legL: leg(15), legR: leg(9) }),
  },
  {
    id: "think",
    label: "Thinking",
    words: "thinking, one hand under the chin",
    expression: "smile",
    // short chibi arms cannot reach their own chin: the far arm crosses over instead
    pose: pose({ head: 6, lookX: -0.3, lookY: -0.45, armL: arm(-42, -96, "front", "fist"), armR: arm(-48, -37) }),
  },
  {
    id: "shrug",
    label: "Shrug",
    words: "shrugging with both palms up",
    expression: "smug",
    pose: pose({ head: 9, armR: arm(70, 60, "mid", "palmUp"), armL: arm(70, 60, "mid", "palmUp") }),
  },
  {
    id: "tada",
    label: "Ta-da",
    words: "arms flung wide in a ta-da pose",
    expression: "happy",
    pose: pose({ torso: 4, armR: arm(100, 16, "mid", "open"), armL: arm(100, 16, "mid", "open"), legL: leg(16), legR: leg(4, 0, 0) }),
  },
  {
    id: "gamer",
    label: "Gaming",
    words: "holding a controller in both hands, locked in",
    expression: "determined",
    pose: pose({ armR: arm(5, -80, "front", "grip"), armL: arm(5, -80, "front", "grip"), legL: leg(9), legR: leg(9) }),
  },
  {
    id: "run",
    label: "Run",
    words: "running flat out",
    expression: "determined",
    pose: pose({
      yaw: 55,
      torso: 10,
      lift: 16,
      armL: arm(60, 70, "back", "fist"),
      armR: arm(45, -85, "front", "fist"),
      legR: leg(-50, 60, 0),
      legL: leg(-30, -70, -40),
    }),
  },
  {
    id: "jump",
    label: "Jump",
    words: "jumping for joy",
    expression: "laugh",
    pose: pose({
      y: 0.66,
      lift: 110,
      armR: arm(...RAISED, "mid", "open"),
      armL: arm(...RAISED, "mid", "open"),
      legL: leg(36, -52, -22),
      legR: leg(36, -52, -22),
    }),
  },
  {
    id: "kick",
    label: "Kick",
    words: "mid-kick, one leg swung up",
    expression: "determined",
    pose: pose({
      yaw: 30,
      torso: -12,
      armR: arm(84, 20, "front", "fist"),
      armL: arm(100, -30, "back", "fist"),
      legR: leg(-96, -8, 10, "front"),
      legL: leg(-4, -6, 0),
    }),
  },
  {
    id: "sit",
    label: "Sit",
    words: "sitting on the ground with legs out in front",
    expression: "smile",
    pose: pose({ y: 0.8, armR: arm(34, -16), armL: arm(34, -16), legL: leg(70, 8, 50, "front"), legR: leg(70, 8, 50, "front") }),
  },
  {
    id: "sneak",
    label: "Sneak",
    words: "sneaking on tiptoe",
    expression: "smug",
    pose: pose({
      yaw: 50,
      torso: 14,
      lookX: -0.6,
      armR: arm(-55, -75, "front"),
      armL: arm(55, 75, "back"),
      legR: leg(-60, 60, -30),
      legL: leg(-28, -10, -16),
    }),
  },
  {
    id: "dab",
    label: "Dab",
    words: "doing a dab",
    expression: "smug",
    pose: pose({
      torso: -8,
      head: -18,
      lookX: -0.4,
      lookY: 0.6,
      armL: arm(125, 0, "mid", "fist"),
      armR: arm(110, 125, "front", "fist"),
      legL: leg(14),
      legR: leg(8),
    }),
  },
];

// ============================================================== scenes ==

export interface Scene {
  id: string;
  label: string;
  words: string;
}

export const SCENES: Scene[] = [
  { id: "arena", label: "Game-show arena", words: "a bright futuristic game-show arena with neon lights, giant screens and falling confetti" },
  { id: "space", label: "Outer space", words: "outer space with ringed planets, twinkling stars and a soft purple nebula, like the team crest" },
  { id: "stream", label: "Streaming room", words: "a cosy streaming room with a gaming desk, glowing monitors and soft RGB lighting" },
  { id: "coop", label: "Farmyard coop", words: "a sunny farmyard with a little wooden chicken coop, green grass and a blue sky" },
  { id: "podium", label: "Winner's podium", words: "a winner's podium under a spotlight with a golden trophy and confetti" },
  { id: "rooftop", label: "Sunset rooftop", words: "a city rooftop at sunset with a glowing skyline behind" },
  { id: "snow", label: "Snowy forest", words: "a snowy forest clearing with gently falling snow" },
  { id: "beach", label: "Beach", words: "a sunny beach with palm trees and gentle waves" },
];

// =============================================================== shots ==

export type AspectId = "1:1" | "4:3" | "3:4" | "16:9" | "9:16";

export const ASPECTS: { id: AspectId; ratio: number; label: string; use: string }[] = [
  { id: "1:1", ratio: 1, label: "Square", use: "roster art, avatars, emotes" },
  { id: "4:3", ratio: 4 / 3, label: "Landscape", use: "posts" },
  { id: "3:4", ratio: 3 / 4, label: "Portrait", use: "posts, cards" },
  { id: "16:9", ratio: 16 / 9, label: "Wide", use: "thumbnails, banners, overlays" },
  { id: "9:16", ratio: 9 / 16, label: "Tall", use: "shorts, stories, phone" },
];

export type ShotId = "roster" | "cutout" | "emote" | "scene";

export interface ShotPreset {
  id: ShotId;
  label: string;
  blurb: string;
  aspect: AspectId;
  background: "white" | "key" | "scene";
  framing: "full" | "posed" | "bust";
}

export const SHOTS: ShotPreset[] = [
  {
    id: "roster",
    label: "Roster art",
    blurb: "Full body on clean white, square — drops straight into Images/ like the current -clean files.",
    aspect: "1:1",
    background: "white",
    framing: "full",
  },
  {
    id: "cutout",
    label: "Cutout",
    blurb: "A flat backdrop that the Finish tab turns transparent, for overlays, thumbnails and stickers.",
    aspect: "1:1",
    background: "key",
    framing: "full",
  },
  {
    id: "emote",
    label: "Emote",
    blurb: "Head-and-shoulders close-up with a big expression that still reads when tiny.",
    aspect: "1:1",
    background: "key",
    framing: "bust",
  },
  {
    id: "scene",
    label: "Scene",
    blurb: "The character in a setting. Pick the shape, then place and size the doll in the frame.",
    aspect: "16:9",
    background: "scene",
    framing: "posed",
  },
];

// ============================================================= helpers ==

/** look an item up by id; an unknown id falls back to the slot's first item */
export function findItem<K extends SlotId>(slot: K, id: string): WardrobeItem<SlotLooks[K]> {
  const list = BY_SLOT[slot] as WardrobeItem<SlotLooks[K]>[];
  return list.find((i) => i.id === id) ?? list[0];
}

export const newPick = pick;
