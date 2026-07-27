// Purchases wrapper (RevenueCat).
//
// The RevenueCat SDK (`react-native-purchases`) is a NATIVE module, so it is
// NOT wired yet - installing it requires a native rebuild. This module is the
// single interface the app calls; once the SDK + App Store Connect + RevenueCat
// are set up, we fill in the bodies below (see each TODO) and everything else
// (paywall, gating) already works.
//
// Wiring steps (later):
//   1. npx expo install react-native-purchases
//   2. add the RevenueCat public API key (below)
//   3. call configure(userId) after login
//   4. rebuild the dev client / EAS build

// export const REVENUECAT_API_KEY = "appl_XXXXXXXXXXXX";

export const PURCHASES_READY = false;

// The RevenueCat entitlement id that grants Pro (must match RevenueCat config).
export const PRO_ENTITLEMENT = "pro";

class NotReadyError extends Error {
  constructor() {
    super("Les paiements ne sont pas encore activés. Reviens bientôt !");
    this.code = "PURCHASES_NOT_READY";
  }
}

// Identify the RevenueCat user with the Supabase user id so the backend
// webhook can flip the right account's is_pro.
export async function configurePurchases(/* userId */) {
  if (!PURCHASES_READY) return;
  // TODO: Purchases.configure({ apiKey: REVENUECAT_API_KEY, appUserID: userId });
}

// Returns the available Pro package, or null.
export async function getProOffering() {
  if (!PURCHASES_READY) return null;
  // TODO: const offerings = await Purchases.getOfferings();
  //       return offerings.current?.availablePackages?.[0] ?? null;
  return null;
}

// Launches the native purchase sheet. Resolves true if the user is now Pro.
export async function purchasePro() {
  if (!PURCHASES_READY) throw new NotReadyError();
  // TODO: const pkg = await getProOffering();
  //       const { customerInfo } = await Purchases.purchasePackage(pkg);
  //       return Boolean(customerInfo.entitlements.active[PRO_ENTITLEMENT]);
  return false;
}

// Restores prior purchases (required by Apple). Resolves true if Pro.
export async function restorePurchases() {
  if (!PURCHASES_READY) throw new NotReadyError();
  // TODO: const customerInfo = await Purchases.restorePurchases();
  //       return Boolean(customerInfo.entitlements.active[PRO_ENTITLEMENT]);
  return false;
}
