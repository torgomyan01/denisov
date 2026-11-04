import type { MenuItem, MenuModifierGroup } from "@/types/site";
import type { CartModifier } from "@/store/cartSlice";

/** True when the guest must pick options before the item can go to cart. */
export const menuItemNeedsModifierChoice = (item: MenuItem): boolean =>
  (item.modifierGroups || []).some(
    (group) => group.minQuantity >= 1 && group.options.length > 0,
  );

export const requiredModifierGroups = (
  item: MenuItem,
): MenuModifierGroup[] =>
  (item.modifierGroups || []).filter(
    (group) => group.minQuantity >= 1 && group.options.length > 0,
  );

export const buildCartLineKey = (
  productId: string,
  modifiers: CartModifier[],
): string => {
  if (!modifiers.length) return productId;
  const sig = [...modifiers]
    .map((m) => `${m.groupId}:${m.productId}:${m.amount}`)
    .sort()
    .join("|");
  return `${productId}__${sig}`.slice(0, 240);
};

export const modifiersLabel = (modifiers: CartModifier[]): string => {
  if (!modifiers.length) return "";
  return modifiers
    .map((m) => m.name.replace(/^[-–—\s]+/, "").trim() || m.name)
    .filter(Boolean)
    .join(", ");
};

export const areModifierSelectionsComplete = (
  groups: MenuModifierGroup[],
  selectedByGroup: Record<string, string[]>,
): boolean => {
  for (const group of groups) {
    if (group.minQuantity < 1) continue;
    const picked = selectedByGroup[group.id] || [];
    if (picked.length < group.minQuantity) return false;
    if (group.maxQuantity > 0 && picked.length > group.maxQuantity) return false;
  }
  return true;
};

export const cartModifiersFromSelection = (
  groups: MenuModifierGroup[],
  selectedByGroup: Record<string, string[]>,
): CartModifier[] => {
  const result: CartModifier[] = [];
  for (const group of groups) {
    const picked = selectedByGroup[group.id] || [];
    for (const productId of picked) {
      const option = group.options.find((o) => o.productId === productId);
      if (!option) continue;
      result.push({
        groupId: group.id,
        groupName: group.name,
        productId: option.productId,
        name: option.name,
        amount: 1,
      });
    }
  }
  return result;
};
