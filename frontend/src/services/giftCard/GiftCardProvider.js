/**
 * Base interface for Gift Card Providers.
 * Any new provider (e.g., Stripe, external API) should extend this class
 * or implement these methods to ensure compatibility with the UI.
 */
class GiftCardProvider {
  /**
   * Fetch all available gift cards to purchase/display
   * @returns {Promise<Array>} Array of gift card objects
   */
  async getAvailableCards() {
    throw new Error("getAvailableCards() must be implemented by the provider");
  }

  /**
   * Fetch details for a specific gift card by ID
   * @param {string} id - The ID of the gift card
   * @returns {Promise<Object>} Gift card details
   */
  async getCardDetails(id) {
    throw new Error("getCardDetails() must be implemented by the provider");
  }

  /**
   * Purchase a gift card
   * @param {string} id - The ID of the gift card brand
   * @param {number} amount - The denomination to purchase
   * @param {Object} [options] - Additional purchase options
   * @returns {Promise<Object>} Transaction result / Purchased card details
   */
  async purchaseCard(id, amount, options = {}) {
    throw new Error("purchaseCard() must be implemented by the provider");
  }
}

export default GiftCardProvider;
