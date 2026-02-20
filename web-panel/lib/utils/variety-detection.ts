/**
 * Variety Detection Utilities
 *
 * Functions for detecting parent-variety relationships and alternative crop names.
 * Used during the merge process in web panel validation.
 */

export interface VarietyRelationship {
  isVariety: boolean
  parent: string | null
  variety: string | null
  varietyType: string | null
}

/**
 * Known alternative names for common crops
 * Maps base crop name (lowercase) to array of alternative names
 */
export const KNOWN_ALTERNATIVES: Record<string, string[]> = {
  // Filipino common crops
  rice: ["palay", "bigas", "kanin"],
  corn: ["maize", "mais"],
  eggplant: ["talong", "brinjal"],
  banana: ["saging", "plantain"],
  mango: ["mangga"],
  tomato: ["kamatis"],
  "sweet potato": ["camote", "kamote"],
  cassava: ["kamoteng kahoy", "yuca", "balinghoy"],
  coconut: ["niyog", "coco"],
  peanut: ["mani", "groundnut"],
  ginger: ["luya"],
  garlic: ["bawang"],
  onion: ["sibuyas"],
  chili: ["sili", "chilli", "chile"],
  "string beans": ["sitaw"],
  okra: ["okra", "lady fingers"],
  pumpkin: ["kalabasa", "squash"],
  papaya: ["papaya"],
  guava: ["bayabas"],
  calamansi: ["calamondin", "kalamansi"],
}

/**
 * Normalize crop name for comparison
 * Converts to lowercase and removes extra whitespace
 */
export function normalizeCropName(name: string): string {
  if (!name) return ""
  return name.toLowerCase().trim().replace(/\s+/g, " ")
}

/**
 * Detect if a crop name is an alternative name for a known base crop
 *
 * @param cropName - Crop name to check
 * @returns Base crop name if alternative detected, otherwise original name
 */
export function detectAlternativeName(cropName: string): string {
  const normalized = normalizeCropName(cropName)

  for (const [baseCrop, alternatives] of Object.entries(KNOWN_ALTERNATIVES)) {
    if (alternatives.some((alt) => normalizeCropName(alt) === normalized)) {
      // Return base crop with proper capitalization
      return baseCrop.charAt(0).toUpperCase() + baseCrop.slice(1)
    }
  }

  return cropName
}

/**
 * Detect parent-variety relationship between two crop names
 *
 * Examples:
 *   "Rice" + "Wetland Rice" → parent="Rice", variety="Wetland Rice", type="Wetland"
 *   "Corn" + "Sweet Corn" → parent="Corn", variety="Sweet Corn", type="Sweet"
 *   "Rice" + "Wheat" → no relationship
 *
 * @param cropName1 - First crop name
 * @param cropName2 - Second crop name
 * @returns Variety relationship information
 */
export function detectVarietyRelationship(
  cropName1: string,
  cropName2: string
): VarietyRelationship {
  const name1 = normalizeCropName(cropName1)
  const name2 = normalizeCropName(cropName2)

  // Same name - not a variety relationship
  if (name1 === name2) {
    return {
      isVariety: false,
      parent: null,
      variety: null,
      varietyType: null,
    }
  }

  // Check if name1 is contained in name2 (name1 is parent, name2 is variety)
  if (name2.includes(name1)) {
    const varietyPrefix = name2.replace(name1, "").trim()
    const varietyType = varietyPrefix
      ? varietyPrefix.charAt(0).toUpperCase() + varietyPrefix.slice(1)
      : null

    return {
      isVariety: true,
      parent: cropName1,
      variety: cropName2,
      varietyType,
    }
  }

  // Check if name2 is contained in name1 (name2 is parent, name1 is variety)
  if (name1.includes(name2)) {
    const varietyPrefix = name1.replace(name2, "").trim()
    const varietyType = varietyPrefix
      ? varietyPrefix.charAt(0).toUpperCase() + varietyPrefix.slice(1)
      : null

    return {
      isVariety: true,
      parent: cropName2,
      variety: cropName1,
      varietyType,
    }
  }

  // No variety relationship detected
  return {
    isVariety: false,
    parent: null,
    variety: null,
    varietyType: null,
  }
}

/**
 * Group crop documents by potential duplicates/varieties
 *
 * @param crops - Array of crop documents with cropName and _id
 * @returns Array of duplicate groups
 */
export function detectDuplicates<T extends { _id: string; cropName: string }>(
  crops: T[]
): Array<{
  baseCropName: string
  documents: Array<{
    id: string
    cropName: string
    isVariety: boolean
    varietyType: string | null
  }>
  suggestedParent: string
  suggestedVarieties: string[]
}> {
  // Normalize and group crops
  const groups = new Map<string, T[]>()

  for (const crop of crops) {
    // Check for alternative names first
    const baseName = detectAlternativeName(crop.cropName)
    const normalizedBase = normalizeCropName(baseName)

    if (!groups.has(normalizedBase)) {
      groups.set(normalizedBase, [])
    }
    groups.get(normalizedBase)!.push(crop)
  }

  // Filter to groups with more than 1 document (potential duplicates)
  const duplicateGroups: ReturnType<typeof detectDuplicates> = []

  for (const [normalizedName, docs] of groups.entries()) {
    if (docs.length <= 1) continue

    // Detect variety relationships within the group
    let parentCrop: T | null = null
    const varieties: Array<{
      crop: T
      varietyType: string | null
    }> = []

    // Find the shortest name - likely the parent
    const sortedByLength = [...docs].sort(
      (a, b) => a.cropName.length - b.cropName.length
    )
    parentCrop = sortedByLength[0]

    // Check other crops for variety relationships with parent
    for (let i = 1; i < sortedByLength.length; i++) {
      const crop = sortedByLength[i]
      const relationship = detectVarietyRelationship(
        parentCrop.cropName,
        crop.cropName
      )

      if (relationship.isVariety) {
        varieties.push({
          crop,
          varietyType: relationship.varietyType,
        })
      } else {
        // Not a variety - might be alternative name or duplicate
        // Keep as part of group but don't classify as variety
        varieties.push({
          crop,
          varietyType: null,
        })
      }
    }

    duplicateGroups.push({
      baseCropName: normalizedName,
      documents: [
        {
          id: parentCrop._id,
          cropName: parentCrop.cropName,
          isVariety: false,
          varietyType: null,
        },
        ...varieties.map((v) => ({
          id: v.crop._id,
          cropName: v.crop.cropName,
          isVariety: v.varietyType !== null,
          varietyType: v.varietyType,
        })),
      ],
      suggestedParent: parentCrop.cropName,
      suggestedVarieties: varieties
        .filter((v) => v.varietyType !== null)
        .map((v) => v.crop.cropName),
    })
  }

  return duplicateGroups
}

/**
 * Get alternative names for a crop from known alternatives
 *
 * @param cropName - Crop name to look up
 * @returns Array of alternative names
 */
export function getAlternativeNames(cropName: string): string[] {
  const normalized = normalizeCropName(cropName)

  for (const [baseCrop, alternatives] of Object.entries(KNOWN_ALTERNATIVES)) {
    if (normalizeCropName(baseCrop) === normalized) {
      return alternatives
    }
  }

  return []
}
