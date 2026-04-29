import MockGiftCardProvider from "./providers/MockGiftCardProvider";

// This factory/service determines which provider to use.
// In the future, this can read from environment variables or configs
// to switch to a real provider like StripeGiftCardProvider.

class GiftCardService {
  constructor() {
    // We instantiate the default provider here.
    // Changing the provider globally is as easy as changing this line:
    this.provider = new MockGiftCardProvider();
  }

  // --- Wrapper Methods to match the provider interface --- //

  async getAvailableCards() {
    return this.provider.getAvailableCards();
  }

  async getCardDetails(id) {
    return this.provider.getCardDetails(id);
  }

  async purchaseCard(id, amount, options = {}) {
    return this.provider.purchaseCard(id, amount, options);
  }
}

// Export a singleton instance
export default new GiftCardService();
